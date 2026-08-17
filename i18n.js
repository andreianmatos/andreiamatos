const SITE_I18N = {
  en: {
    'nav.home': 'index',
    'nav.about': 'about',
    'nav.works': 'works',
    'bio.line': 'Computer scientist and artist.',
    'cv.birth': 'born 1999 in Viseu, based in Lisboa',
    'contact.at': 'Contact at ',
    'contact.or': ' or ',
    'cv.education': 'education',
    'cv.workshops': 'workshops',
    'cv.residencies': 'residencies',
    'cv.work': 'work experience',
    'cv.other': 'work experience: other',
    'edu.pg.title': 'Post-Graduation in Communication Sciences: Contemporary Culture and New Technologies',
    'edu.msc.title': 'MSc in Computer Science and Engineering: Artificial Intelligence · Interaction and Visualization',
    'edu.erasmus.title': 'Erasmus Exchange Programme',
    'edu.erasmus.meta': 'ENSIMAG, Université Grenoble Alpes (UGA), Grenoble, France',
    'edu.bsc.title': 'BSc in Computer Science and Engineering',
    'ws.ill.title': 'Advanced Illustration Seminar',
    'ws.dreams.title': 'Alternative Dreams: Alternative photographic printing processes',
    'ws.bind.title': 'Classical Bookbinding Workshop',
    'ws.cer.title': 'Ceramics Club',
    'job.ds.title': 'Data Scientist / Machine Learning Engineer',
    'job.ds.year': '01.2023–present',
    'job.ra.title': 'Research Assistant',
    'job.ra.meta': 'Tallinn University (TLU), Estonia',
    'job.ta.title': 'Invited Teaching Assistant',
    'job.intern.title': 'Research Intern',
    'other.prog.title': 'Programming Team',
    'other.prod.title': 'Production Support: Volunteer',
    'other.kino.title': 'Co-Founder',
    'works.ceramics': 'ceramics',
    'works.images': 'images',
    'works.drawings': 'drawings',
    'works.videos': 'videos',
    'works.writings': 'writings',
    'works.websites': 'websites',
    'works.archive': 'archive',
    'works.thisone': 'this one :)',
    'works.linhas.meta': 'Picture Book',
    'works.thesis.meta': "Master's thesis, Instituto Superior Técnico",
  },
  pt: {
    'nav.home': 'index',
    'nav.about': 'sobre',
    'nav.works': 'trabalhos',
    'bio.line': 'Cientista da computação e artista.',
    'cv.birth': 'nascida em 1999 em Viseu, baseada em Lisboa',
    'contact.at': 'Contacto: ',
    'contact.or': ' ou ',
    'cv.education': 'formação',
    'cv.workshops': 'oficinas',
    'cv.residencies': 'residências',
    'cv.work': 'experiência profissional',
    'cv.other': 'experiência profissional: outra',
    'edu.pg.title': 'Pós-graduação em Ciências da Comunicação: Cultura Contemporânea e Novas Tecnologias',
    'edu.msc.title': 'Mestrado em Engenharia Informática e de Computadores: Inteligência Artificial · Interação e Visualização',
    'edu.erasmus.title': 'Programa de intercâmbio Erasmus',
    'edu.erasmus.meta': 'ENSIMAG, Université Grenoble Alpes (UGA), Grenoble, França',
    'edu.bsc.title': 'Licenciatura em Engenharia Informática e de Computadores',
    'ws.ill.title': 'Seminário Avançado de Ilustração',
    'ws.dreams.title': 'Alternative Dreams: Processos alternativos de impressão fotográfica',
    'ws.bind.title': 'Oficina de encadernação clássica',
    'ws.cer.title': 'Clube de Cerâmica',
    'job.ds.title': 'Cientista de dados / Engenheira de Machine Learning',
    'job.ds.year': '01.2023–presente',
    'job.ra.title': 'Assistente de investigação',
    'job.ra.meta': 'Tallinn University (TLU), Estónia',
    'job.ta.title': 'Assistente convidada',
    'job.intern.title': 'Estagiária de investigação',
    'other.prog.title': 'Equipa de programação',
    'other.prod.title': 'Apoio à produção: Voluntariado',
    'other.kino.title': 'Co-fundadora',
    'works.ceramics': 'cerâmica',
    'works.images': 'imagens',
    'works.drawings': 'desenhos',
    'works.videos': 'vídeos',
    'works.writings': 'textos',
    'works.websites': 'websites',
    'works.archive': 'arquivo',
    'works.thisone': 'este :)',
    'works.linhas.meta': 'Livro ilustrado',
    'works.thesis.meta': 'Dissertação de mestrado, Instituto Superior Técnico',
  },
};

function detectSiteLang() {
  try {
    const saved = localStorage.getItem('site-lang');
    if (saved === 'pt' || saved === 'en') return saved;
  } catch (_) {
    /* ignore */
  }
  const nav = (navigator.language || 'pt').toLowerCase();
  return nav.startsWith('pt') ? 'pt' : 'en';
}

let siteLang = detectSiteLang();

function getSiteLang() {
  return siteLang;
}

function tSite(key) {
  return SITE_I18N[siteLang]?.[key] ?? SITE_I18N.en[key] ?? key;
}

function applyDomI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const text = tSite(el.dataset.i18n);
    if (el.classList.contains('works-title')) {
      const em = document.createElement('em');
      em.textContent = text;
      el.replaceChildren(em);
      return;
    }
    el.textContent = text;
  });
  document.querySelectorAll('[data-lang]').forEach((el) => {
    const current = el.dataset.lang === siteLang;
    el.classList.toggle('is-current', current);
    if (current) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
}

function setSiteLang(lang) {
  if (lang !== 'pt' && lang !== 'en') return;
  if (lang === siteLang) return;
  siteLang = lang;
  try {
    localStorage.setItem('site-lang', lang);
  } catch (_) {
    /* ignore */
  }
  document.documentElement.lang = lang;
  applyDomI18n();
  window.dispatchEvent(new CustomEvent('site-lang-change', { detail: lang }));
}

window.getSiteLang = getSiteLang;
window.tSite = tSite;
window.setSiteLang = setSiteLang;

document.documentElement.lang = siteLang;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyDomI18n);
} else {
  applyDomI18n();
}
