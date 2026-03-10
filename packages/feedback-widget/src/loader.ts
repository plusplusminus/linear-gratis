/**
 * Pulse Cookie Loader (~300B minified)
 *
 * Checks for `pulse_enabled=1` cookie before loading the full widget.
 * Clients embed this instead of pulse.js when they want cookie-gated access.
 *
 * Enable:  document.cookie = "pulse_enabled=1; path=/; max-age=31536000"
 * Disable: document.cookie = "pulse_enabled=; path=/; max-age=0"
 */
;(function (w, d) {
  if (!/(?:^|;\s*)pulse_enabled=1/.test(d.cookie)) return
  var c = (w as any).PulseConfig
  if (!c || !c.widgetKey) return
  var s = d.createElement('script')
  s.async = true
  s.src = (c.loaderBase || 'https://r2.lineargratis.com/widget/v1') + '/pulse.js'
  if (c.onReady) s.onload = c.onReady
  var r = d.getElementsByTagName('script')[0]
  r && r.parentNode ? r.parentNode.insertBefore(s, r) : d.head.appendChild(s)
})(window, document)
