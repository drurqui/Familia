EN TU PC (VS CODE)

Compilar el proyecto: npm run build

Enviar al servidor: scp -r ./dist durquilla@familia.urquilla.net:~/

EN EL SERVIDOR (DEBIAN)

Borrar archivos viejos: sudo rm -rf /var/www/html/familia/dist/*

Poner archivos nuevos: sudo cp -r ~/dist/* /var/www/html/familia/dist/

Dar permisos: sudo chown -R www-data:www-data /var/www/html/familia/dist

Dar permisos: sudo chmod -R 755 /var/www/html/familia/dist

MOTOR DE RED (SCRIPT BASH)

Ubicación: /var/www/html/familia/network-metrics.sh

Reiniciar el script:
sudo pkill -f network-metrics.sh
sudo nohup /var/www/html/familia/network-metrics.sh > /dev/null 2>&1 &

Ver si funciona: cat /var/www/html/familia/network-metrics.json

REGLAS DE TAILWIND 4

No usar corchetes [] para tamaños.

Usar escala numérica: h-88 (para 22rem) y min-h-50 (para 200px).

Colores de fondo: #09090b y #121214.

NOTA

Si los cambios no se ven al cargar la web, presiona Ctrl + Shift + R.