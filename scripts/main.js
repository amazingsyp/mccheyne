import { start, register } from './router.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { renderReader } from './views/reader.js';
import { renderBible } from './views/bible.js';

register('/today', renderToday);
register('/today/:day', renderToday);
register('/calendar', renderCalendar);
register('/calendar/:ym', renderCalendar);
register('/bible', renderBible);
register('/bible/:book', renderBible);
register('/read/:book/:chapter', renderReader);

function highlightNav() {
  const hash = location.hash.slice(1) || '/today';
  const top = hash.split('/')[1] || 'today';
  for (const link of document.querySelectorAll('.app-nav a')) {
    link.classList.toggle('is-active', link.dataset.route === top);
  }
}
window.addEventListener('hashchange', highlightNav);
highlightNav();

start();
