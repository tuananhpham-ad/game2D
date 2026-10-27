'use strict';

/* Nút 🔔/🔕 cạnh dòng "Đột biến kế": tắt bảng thông báo bật to giữa màn hình,
   thay bằng một dòng nhỏ đứng yên ở mép trên sân chơi. Lựa chọn được nhớ cho mọi game. */
(function () {
  let quiet = false;
  try { quiet = localStorage.getItem('arcade_quiet') === '1'; } catch (e) { /* bỏ qua */ }

  function apply(btn) {
    document.body.classList.toggle('quiet-banners', quiet);
    btn.textContent = quiet ? '🔕' : '🔔';
    btn.title = quiet ? 'Đang hiện thông báo gọn — bấm để hiện bảng lớn' : 'Bấm để thông báo không bật lên giữa màn hình';
    btn.setAttribute('aria-pressed', String(quiet));
  }

  const next = document.getElementById('next');
  if (!next) return;
  const row = document.createElement('div');
  row.className = 'status-row';
  next.parentNode.insertBefore(row, next);
  row.appendChild(next);

  const btn = document.createElement('button');
  btn.className = 'quiet-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Bật/tắt thông báo bật lên');
  btn.addEventListener('click', () => {
    quiet = !quiet;
    try { localStorage.setItem('arcade_quiet', quiet ? '1' : '0'); } catch (e) { /* bỏ qua */ }
    apply(btn);
  });
  row.appendChild(btn);
  apply(btn);
})();
