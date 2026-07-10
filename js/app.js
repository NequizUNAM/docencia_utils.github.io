function loadPartial(selector, url, callback) {
  fetch(url)
    .then(res => res.text())
    .then(html => {
      document.querySelector(selector).innerHTML = html;
      if (callback) callback();
    })
    .catch(err => console.error('Error cargando partial:', url, err));
}

document.addEventListener('DOMContentLoaded', function () {
  loadPartial('#header-container', 'partials/header.html', function () {

    // 1. Marca link activo en sidebar
    document.querySelectorAll('#mainMenu .nav-link').forEach(link => {
      if (link.href === window.location.href) {
        link.classList.add('active');
        link.style.background = 'rgba(255,255,255,0.15)';
        link.style.borderRadius = '6px';
      }
    });

    // 2. Clona el menú del sidebar al offcanvas móvil sin duplicar HTML
    const menuDesktop = document.querySelector('#mainMenu');
    const menuMobile  = document.querySelector('#menuMobileContent');
    if (menuDesktop && menuMobile) {
      const clone = menuDesktop.cloneNode(true);
      clone.id = 'mainMenuMobile';
      // Ajusta colores para fondo blanco del offcanvas
      clone.querySelectorAll('.nav-link').forEach(l => {
        l.style.color = '#001f5b';
      });
      menuMobile.appendChild(clone);
    }

  });

  loadPartial('#footer-container', 'partials/footer.html');
});