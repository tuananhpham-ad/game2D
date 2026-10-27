'use strict';

/* Mã hồi sinh dùng chung cho mọi game trong sảnh.
   Chỉ lưu giá trị băm của mã (không để lộ mã trong source), so khớp không phân biệt
   hoa/thường, dấu tiếng Việt và khoảng trắng: "Dũng xinh gái" cũng được. */
(function () {
  const CODE_HASH = 3371689543;

  function normalize(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }

  const check = code => fnv1a(normalize(code)) === CODE_HASH;

  // Gắn ô nhập mã vào `el`. Nhập đúng thì gọi onRevive().
  function mount(el, onRevive) {
    el.innerHTML =
      '<form class="revive" autocomplete="off">' +
      '<input type="text" placeholder="Nhập mã hồi sinh…" aria-label="Mã hồi sinh" spellcheck="false">' +
      '<button type="submit">Hồi sinh</button>' +
      '<div class="revive-msg" aria-live="polite"></div>' +
      '</form>';
    const form = el.querySelector('form'), input = el.querySelector('input'), msg = el.querySelector('.revive-msg');
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (check(input.value)) {
        input.value = '';
        msg.textContent = '';
        onRevive();
      } else {
        msg.textContent = input.value.trim() ? 'Sai mã rồi 😝' : 'Nhập mã trước đã';
        form.classList.remove('wrong'); void form.offsetWidth; form.classList.add('wrong');
      }
    });
  }

  window.Revive = { check, mount };
})();
