/**
 * The Black Friday days (snippets/alc-bf-peak).
 *
 * Every [data-bf-peak data-peak-start="YYYY-MM-DD" data-peak-end="YYYY-MM-DD"] gets
 * data-peak="day|mid|last" from today's date in Bucharest, or loses it outside the dates, so
 * a page served from cache switches at midnight. Inside it, elements with
 * data-peak-text-day / -mid / -last (and -off for outside the dates) take that text, and
 * [data-peak-date] shows today's date (dd.mm). The styles key off data-peak.
 */
(() => {
  if (window.alcBfPeak) return;
  window.alcBfPeak = true;

  function todayInBucharest() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      return '';
    }
  }

  function phaseOf(today, start, end) {
    if (!today || !start || !end || today < start || today > end) return '';
    if (today === start) return 'day';
    if (today === end) return 'last';
    return 'mid';
  }

  function sync() {
    const today = todayInBucharest();
    if (!today) return;
    const [, m, d] = today.split('-');
    document.querySelectorAll('[data-bf-peak]').forEach((root) => {
      const phase = phaseOf(today, root.dataset.peakStart, root.dataset.peakEnd);
      if (phase) root.dataset.peak = phase;
      else delete root.dataset.peak;
      const key = phase ? `peakText${phase[0].toUpperCase()}${phase.slice(1)}` : 'peakTextOff';
      root.querySelectorAll('[data-peak-text-day]').forEach((el) => {
        if (el.dataset[key] != null && el.textContent !== el.dataset[key]) el.textContent = el.dataset[key];
      });
      root.querySelectorAll('[data-peak-date]').forEach((el) => {
        el.textContent = `${d}.${m}`;
      });
      if (root.matches('.alc-bf-band')) root.hidden = !phase;
    });
  }

  const start = () => {
    sync();
    // Once a minute is enough to catch midnight.
    setInterval(sync, 60000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
