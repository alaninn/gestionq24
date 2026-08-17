#!/bin/bash
# =============================================================================
#  HARDENING para VPS de Lineage 2 (Linux) — capa de defensa contra floods y
#  accesos no autorizados. Segunda capa: NO reemplaza a una protección Anti-DDoS
#  de red (OVH Game / proxy). Un flood volumétrico grande satura el uplink igual;
#  esto frena ataques chicos/medianos, escaneos y fuerza bruta.
#
#  USO (en el VPS, como root):
#     nano hardening-l2.sh        # revisá y ajustá las VARIABLES de abajo
#     chmod +x hardening-l2.sh
#     ./hardening-l2.sh
#
#  ⚠️ IMPORTANTE:
#   - Ajustá SSH_PORT al puerto real de tu SSH ANTES de correrlo (o te podés
#     quedar afuera).
#   - Este script NO pone el firewall en "denegar todo" por defecto (para no
#     bloquearte). Agrega protecciones puntuales. Al final te explico cómo pasar
#     a denegar-todo de forma segura.
#   - Probá en un horario de poca gente y tené acceso por consola del panel del
#     VPS por las dudas.
# =============================================================================
set -e

# ---------------- VARIABLES (AJUSTAR) ----------------
SSH_PORT=22            # puerto de tu SSH
LOGIN_PORT=2106        # LoginServer L2
GAME_PORT=7777         # GameServer L2
WEB_PORTS="80 443"     # web (si la sirve este mismo VPS)
MAX_CONN_POR_IP=30     # conexiones simultáneas por IP a los puertos de juego
                       # (un cliente L2 abre pocas; 30 es holgado. Si ves cortes
                       #  legítimos, subilo. Si querés más estricto, bajalo.)
# -----------------------------------------------------

echo ">> 1/4  Ajustes del kernel (sysctl): anti SYN-flood y red más robusta"
cat > /etc/sysctl.d/99-l2-hardening.conf <<'EOF'
# Cookies SYN: sobrevivir a inundaciones de SYN sin agotar la tabla
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 3
# Colas y reuso
net.core.somaxconn = 4096
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
# Anti-spoofing (reverse path filter)
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
# No responder a pings de broadcast / redirecciones ICMP (evita amplificación)
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
# Loguear paquetes marcianos (IPs imposibles)
net.ipv4.conf.all.log_martians = 1
EOF
sysctl --system >/dev/null
echo "   ok."

echo ">> 2/4  Reglas de firewall (iptables) — protecciones puntuales"
# Cadena para descartar basura común
iptables -N L2CLEAN 2>/dev/null || iptables -F L2CLEAN
# Paquetes inválidos: afuera
iptables -A L2CLEAN -m conntrack --ctstate INVALID -j DROP
# Escaneos con flags TCP imposibles: afuera
iptables -A L2CLEAN -p tcp --tcp-flags ALL NONE -j DROP
iptables -A L2CLEAN -p tcp --tcp-flags ALL ALL -j DROP
iptables -A L2CLEAN -p tcp --tcp-flags SYN,FIN SYN,FIN -j DROP
iptables -A L2CLEAN -p tcp --tcp-flags SYN,RST SYN,RST -j DROP
iptables -A L2CLEAN -j RETURN
# Enganchar la limpieza al principio del tráfico entrante (una sola vez)
iptables -C INPUT -j L2CLEAN 2>/dev/null || iptables -I INPUT 1 -j L2CLEAN

# Permitir siempre loopback y conexiones ya establecidas
iptables -C INPUT -i lo -j ACCEPT 2>/dev/null || iptables -I INPUT 2 -i lo -j ACCEPT
iptables -C INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || iptables -I INPUT 3 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# SSH: frenar fuerza bruta (máx 4 intentos nuevos por IP cada 60s)
iptables -C INPUT -p tcp --dport "$SSH_PORT" -m conntrack --ctstate NEW -m recent --set --name SSH 2>/dev/null || \
  iptables -A INPUT -p tcp --dport "$SSH_PORT" -m conntrack --ctstate NEW -m recent --set --name SSH
iptables -C INPUT -p tcp --dport "$SSH_PORT" -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 5 --name SSH -j DROP 2>/dev/null || \
  iptables -A INPUT -p tcp --dport "$SSH_PORT" -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 5 --name SSH -j DROP

# Puertos de juego: limitar conexiones simultáneas por IP (mitiga floods de conexión)
for P in "$LOGIN_PORT" "$GAME_PORT"; do
  iptables -C INPUT -p tcp --dport "$P" -m connlimit --connlimit-above "$MAX_CONN_POR_IP" -j DROP 2>/dev/null || \
    iptables -A INPUT -p tcp --dport "$P" -m connlimit --connlimit-above "$MAX_CONN_POR_IP" -j DROP
  # Limitar la tasa de conexiones NUEVAS por IP (anti flood de aperturas)
  iptables -C INPUT -p tcp --dport "$P" -m conntrack --ctstate NEW -m recent --set --name L2$P 2>/dev/null || \
    iptables -A INPUT -p tcp --dport "$P" -m conntrack --ctstate NEW -m recent --set --name L2$P
  iptables -C INPUT -p tcp --dport "$P" -m conntrack --ctstate NEW -m recent --update --seconds 10 --hitcount 20 --name L2$P -j DROP 2>/dev/null || \
    iptables -A INPUT -p tcp --dport "$P" -m conntrack --ctstate NEW -m recent --update --seconds 10 --hitcount 20 --name L2$P -j DROP
done

# Base de datos: NUNCA expuesta a Internet. Solo localhost.
for DBP in 3306 5432; do
  iptables -C INPUT -p tcp --dport "$DBP" ! -s 127.0.0.1 -j DROP 2>/dev/null || \
    iptables -A INPUT -p tcp --dport "$DBP" ! -s 127.0.0.1 -j DROP
done
echo "   ok. (recordá que la DB además debe bind a 127.0.0.1 en su config)"

echo ">> 3/4  fail2ban (bloqueo automático de IPs que atacan SSH)"
if ! command -v fail2ban-server >/dev/null 2>&1; then
  (apt-get update -y && apt-get install -y fail2ban) || echo "   (instalá fail2ban a mano si tu distro no es Debian/Ubuntu)"
fi
cat > /etc/fail2ban/jail.d/l2-ssh.conf <<EOF
[sshd]
enabled = true
port = $SSH_PORT
maxretry = 5
findtime = 600
bantime = 3600
EOF
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban >/dev/null 2>&1 || true
echo "   ok."

echo ">> 4/4  Guardar las reglas para que sobrevivan al reinicio"
if command -v netfilter-persistent >/dev/null 2>&1; then netfilter-persistent save >/dev/null 2>&1 || true
elif command -v iptables-save >/dev/null 2>&1; then iptables-save > /etc/iptables.rules 2>/dev/null || true; fi
echo "   ok."

echo ""
echo "==================================================================="
echo " LISTO. Protecciones activas. Verificá tu acceso SSH en OTRA terminal"
echo " ANTES de cerrar esta sesión."
echo ""
echo " PASO OPCIONAL (avanzado) — firewall 'denegar todo por defecto':"
echo "   Es lo más seguro, pero mal hecho te deja afuera. Antes de aplicarlo,"
echo "   programá un rollback automático por si te bloqueás:"
echo "     echo 'iptables -P INPUT ACCEPT; iptables -F' | at now + 10 minutes"
echo "   Luego permití lo necesario y recién ahí:"
echo "     iptables -P INPUT DROP"
echo "   Si seguís con acceso, cancelá el rollback:  atrm <nro-de-trabajo>"
echo "==================================================================="
