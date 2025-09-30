// injeta bloco responsivo no #ads-footer e só dá push quando tiver largura
(function mountFooterAd(){
  var host = document.getElementById('ads-footer');
  if (!host) return;

  // insere o <ins>
  host.innerHTML = 
    '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8901472162453586" ' +
    '     crossorigin="anonymous"></script> ' +
    '<!-- Emoji Play --> ' +
    '<ins class="adsbygoogle" ' +
    '     style="display:block" ' +
    '     data-ad-client="ca-pub-8901472162453586" ' +
    '     data-ad-slot="2405173300" ' +
    '     data-ad-format="auto" ' +
    '     data-full-width-responsive="true"></ins> ' +
    '<script> ' +
    '     (adsbygoogle = window.adsbygoogle || []).push({}); ' +
    '</script>';

  function tryPush(){
    var el = host.querySelector('.adsbygoogle');
    if (!el) return;
    if (el.offsetWidth === 0) { requestAnimationFrame(tryPush); return; }
    (adsbygoogle = window.adsbygoogle || []).push({});
  }
  tryPush();
})();
