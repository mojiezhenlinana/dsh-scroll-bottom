/**
 * dsh-scroll-bottom — 浏览器半边。
 *
 * 在输入框上方中间画一个圆形「回到底部」按钮：
 *   · 往上翻历史之后才出现（已经在底部时不打扰）；
 *   · 点一下把对话滚回最底（平滑滚动）；
 *   · 位置按输入框真实坐标算（不是窗口居中），左右跟着输入框走；
 *   · 视觉直接从输入框那张卡上抄：底色、模糊、边框、阴影、文字色 —— 换主题/换壁纸
 *     也会在下一次刷新时跟着变。
 *
 * 宿主锚点（0.2.x 内核，见 dsh-client-ui-chat）：
 *   [data-conversation-scroll] —— 对话滚动容器
 *   [data-composer-seat]       —— 输入框所在的 sticky 座
 */
window.__ModuleLoader__.load({
  id: 'dsh-scroll-bottom',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports

    const SIZE = 36
    const SHOW_GAP = 120
    const GAP_ABOVE = 10

    const CSS = `
      .dsh-scroll-bottom-btn {
        position: fixed; z-index: 60;
        width: ${SIZE}px; height: ${SIZE}px; padding: 0; margin: 0;
        display: flex; align-items: center; justify-content: center;
        border-radius: 50% !important; cursor: pointer; line-height: 0;
        overflow: hidden; aspect-ratio: 1 / 1;
        color: rgba(22, 26, 32, .62);
        background: rgba(255, 255, 255, .32);
        border: 0 !important;
        box-shadow: none !important;
        -webkit-backdrop-filter: blur(12px) saturate(1.2); backdrop-filter: blur(12px) saturate(1.2);
        opacity: 0; visibility: hidden; transform: translateY(6px);
        transition: opacity .16s ease, transform .16s ease, background .12s ease;
      }
      .dsh-scroll-bottom-btn[data-show="1"] { opacity: 1; visibility: visible; transform: translateY(0); }
      .dsh-scroll-bottom-btn:hover { background: rgba(255, 255, 255, .52); }
      /* 主题/壁纸插件有时给 button 挂玻璃伪元素，圆角跟着它们走就显得"方"，直接掐掉。 */
      .dsh-scroll-bottom-btn::before, .dsh-scroll-bottom-btn::after { content: none !important; display: none !important; }
      .dsh-scroll-bottom-btn:active { transform: scale(.94); }
      .dsh-scroll-bottom-btn svg { width: 18px; height: 18px; display: block; }
    `

    function scrollable(el) {
      if (!el || el.nodeType !== 1) return false
      if (el.scrollHeight <= el.clientHeight + 4) return false
      try {
        const oy = getComputedStyle(el).overflowY
        return oy === 'auto' || oy === 'scroll' || oy === 'overlay'
      } catch { return false }
    }

    /** 对话滚动容器：优先用宿主自己标的属性，其次按「包含消息且可滚动」往上找。 */
    function findScroller() {
      const marked = document.querySelector('[data-conversation-scroll]')
      if (marked && scrollable(marked)) return marked
      const anchor = document.querySelector('[data-chat-flow], [data-chat-flow-key]')
      if (!anchor) return marked || null
      let el = anchor.parentElement
      while (el && el !== document.body) {
        if (scrollable(el)) return el
        el = el.parentElement
      }
      return marked || null
    }

    function composerSeat() {
      return document.querySelector('[data-composer-seat]')
    }

    /** 输入框本体（textarea / 可编辑区）；取不到就退回座位元素。 */
    function composerInput(seat) {
      if (!seat) return null
      return seat.querySelector('textarea, [contenteditable="true"], [role="textbox"]') || seat
    }

    /**
     * 输入框那张卡：从座位里找第一个「有底色且带圆角」的元素 —— 那就是视觉上的卡片，
     * 按钮从它身上抄质感。
     */
    function composerCard(seat) {
      if (!seat) return null
      let found = null
      const visit = (el, depth) => {
        if (found || !el || depth > 5) return
        let cs
        try { cs = getComputedStyle(el) } catch { return }
        if (!cs) return
        const bg = cs.backgroundColor
        const opaque = bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)'
        const radius = parseFloat(cs.borderTopLeftRadius) || 0
        if (opaque && radius >= 6) { found = el; return }
        for (const child of el.children) visit(child, depth + 1)
      }
      visit(seat, 0)
      return found || seat
    }

    function apply(ctx) {
      const doc = document
      if (!doc || !doc.body) return

      // 热加载 / 重复挂载时旧实例可能没被清掉，旧按钮会叠在新按钮下面（形状、白点都会
      // 串味）。挂载前先把自己上一次留下的节点和样式清干净，保证屏上只有一个。
      try {
        for (const stale of doc.querySelectorAll('.dsh-scroll-bottom-btn')) stale.remove()
        for (const stale of doc.querySelectorAll('style[data-plugin="dsh-scroll-bottom"]')) stale.remove()
      } catch { /* ignore */ }

      const styleEl = doc.createElement('style')
      styleEl.setAttribute('data-plugin', 'dsh-scroll-bottom')
      styleEl.textContent = CSS
      doc.head.appendChild(styleEl)

      const btn = doc.createElement('button')
      btn.type = 'button'
      btn.className = 'dsh-scroll-bottom-btn'
      btn.title = '回到底部'
      btn.setAttribute('aria-label', '回到底部')
      btn.dataset.show = '0'
      // 内联兜底：宿主/主题对 button 的圆角规则优先级可能比我们的类还高，
      // 这条内联 + important 保证永远是正圆（不像素级的方角）。
      try { btn.style.setProperty('border-radius', '50%', 'important') } catch { /* ignore */ }
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"'
        + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M12 4.5v14" /><path d="M5.5 12l6.5 6.5L18.5 12" /></svg>'
      doc.body.appendChild(btn)

      let timer = 0
      let raf = 0

      /**
       * 固定白色毛玻璃：不再从输入框抄配色（深色主题下会糊成一坨、不明显）。
       * 内联写死是为了不被主题的 button 规则盖掉，每轮刷新重写一遍以防宿主重置。
       */
      function syncSkin() {
        const set = (k, v) => { try { btn.style.setProperty(k, v, 'important') } catch { /* ignore */ } }
        set('background-color', 'rgba(255, 255, 255, .32)')
        set('background-image', 'none')
        set('backdrop-filter', 'blur(12px) saturate(1.2)')
        set('-webkit-backdrop-filter', 'blur(12px) saturate(1.2)')
        // 外边框会被 clip-path 从中间裁断，顶端/右侧留下不均匀的白弧；
        // 改成内侧描边（inset），整圈都在裁剪范围内，边缘干净。
        set('border', '0')
        set('box-shadow', 'none')
        set('color', 'rgba(22, 26, 32, .62)')
      }

      function place(seat) {
        const target = composerInput(seat)
        if (target) {
          const r = target.getBoundingClientRect()
          if (r.width > 0) {
            btn.style.left = Math.round(r.left + r.width / 2 - SIZE / 2) + 'px'
            btn.style.top = Math.round(Math.max(8, r.top - SIZE - GAP_ABOVE)) + 'px'
            return
          }
        }
        btn.style.left = Math.round(window.innerWidth / 2 - SIZE / 2) + 'px'
        btn.style.top = Math.round(window.innerHeight - 180) + 'px'
      }

      /** 形状锁定：宿主/主题对 button 的尺寸与圆角规则优先级经常比我们高，
       *  每轮刷新都重新写一次内联 important —— 宽高定死成正方形，圆角 50% 才是正圆。
       *  另外用 clip-path 再裁一个圆：圆角可能被别处的 `border-radius` 抢走（或边框
       *  让 50% 落在略大的盒子上，看着"还有点方"），裁剪不认别的规则，一定圆。 */
      function lockShape() {
        try {
          btn.style.setProperty('width', SIZE + 'px', 'important')
          btn.style.setProperty('height', SIZE + 'px', 'important')
          btn.style.setProperty('min-width', SIZE + 'px', 'important')
          btn.style.setProperty('min-height', SIZE + 'px', 'important')
          btn.style.setProperty('padding', '0', 'important')
          btn.style.setProperty('box-sizing', 'border-box', 'important')
          btn.style.setProperty('border-radius', '50%', 'important')
          btn.style.setProperty('overflow', 'hidden', 'important')
          // 圆角在主样式里已经锁成 50%，但主题的 button 规则可能仍然抢它（表现为"变方"）。
          // 裁剪不认别的规则，所以再裁一刀；上一版的白点是内侧描边被裁成虚线造成的，
          // 现在边框与阴影都已去掉，裁剪边缘不会再有亮环。
          btn.style.setProperty('clip-path', 'circle(50% at 50% 50%)', 'important')
        } catch { /* ignore */ }
      }

      function refresh() {
        raf = 0
        try {
          lockShape()
          const seat = composerSeat()
          place(seat)
          syncSkin()
          const sc = findScroller()
          if (!sc) { btn.dataset.show = '0'; return }
          const gap = sc.scrollHeight - sc.scrollTop - sc.clientHeight
          btn.dataset.show = gap > SHOW_GAP ? '1' : '0'
        } catch { /* 布局没就绪时忽略这一轮 */ }
      }

      function schedule() {
        if (raf) return
        raf = requestAnimationFrame(refresh)
      }

      function scheduleSlow() {
        if (timer) return
        timer = setTimeout(() => { timer = 0; schedule() }, 120)
      }

      function onClick() {
        const sc = findScroller()
        if (!sc) return
        try { sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' }) }
        catch { sc.scrollTop = sc.scrollHeight }
        schedule()
      }

      btn.addEventListener('click', onClick)
      window.addEventListener('resize', schedule)
      doc.addEventListener('scroll', schedule, true)

      let observer = null
      try {
        observer = new MutationObserver(scheduleSlow)
        observer.observe(doc.body, { childList: true, subtree: true })
      } catch { observer = null }

      schedule()

      const dispose = () => {
        try { window.removeEventListener('resize', schedule) } catch { /* ignore */ }
        try { doc.removeEventListener('scroll', schedule, true) } catch { /* ignore */ }
        if (observer) { try { observer.disconnect() } catch { /* ignore */ } }
        if (timer) { clearTimeout(timer); timer = 0 }
        if (raf) { cancelAnimationFrame(raf); raf = 0 }
        try { btn.removeEventListener('click', onClick) } catch { /* ignore */ }
        try { btn.remove() } catch { /* ignore */ }
        try { styleEl.remove() } catch { /* ignore */ }
      }

      if (typeof ctx.effect === 'function') ctx.effect(() => dispose)
      else return dispose
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})
