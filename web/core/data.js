/**
 * Static reference data for the honest-resume engine.
 * Pure data, no side effects. Safe to ship to the browser and to Deno.
 */

// ---------------------------------------------------------------------------
// Action verbs (SPEC section 20: ~60 curated verbs grouped by category)
// ---------------------------------------------------------------------------

/** @type {Record<string, string[]>} */
const VERB_GROUPS = {
  Coordination: ['Coordinated', 'Organized', 'Managed', 'Led', 'Planned', 'Scheduled', 'Arranged', 'Oversaw', 'Supervised', 'Facilitated', 'Hosted', 'Handled'],
  Creative: ['Designed', 'Edited', 'Created', 'Produced', 'Filmed', 'Illustrated', 'Composed', 'Animated', 'Storyboarded', 'Drafted', 'Shot', 'Styled', 'Graded', 'Recorded', 'Captured'],
  Technical: ['Built', 'Developed', 'Programmed', 'Implemented', 'Tested', 'Debugged', 'Deployed', 'Automated', 'Configured', 'Integrated', 'Maintained', 'Migrated'],
  Communication: ['Wrote', 'Presented', 'Published', 'Documented', 'Explained', 'Pitched', 'Reported', 'Interviewed', 'Translated', 'Summarized'],
  Teamwork: ['Collaborated', 'Assisted', 'Supported', 'Mentored', 'Trained', 'Volunteered', 'Contributed', 'Partnered', 'Guided'],
  Improvement: ['Improved', 'Reduced', 'Increased', 'Streamlined', 'Simplified', 'Optimized', 'Resolved', 'Researched', 'Analyzed', 'Measured', 'Updated', 'Revised', 'Launched'],
};

const VERB_FLAT = Object.values(VERB_GROUPS).flat().sort((a, b) => a.localeCompare(b));

/**
 * Approved action verbs.
 * - `groups`: verbs grouped by category (for pickers)
 * - `flat`: sorted flat list
 * - `set`: Set of lowercase verbs for fast membership tests
 */
export const VERBS = Object.freeze({
  groups: VERB_GROUPS,
  flat: VERB_FLAT,
  set: new Set(VERB_FLAT.map((v) => v.toLowerCase())),
});

// ---------------------------------------------------------------------------
// Skill catalog
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CatalogSkill
 * @property {string} name canonical display name
 * @property {'core'|'tool'|'programming'} category
 * @property {string[]} aliases alternative spellings (matched case-insensitively, word-bounded)
 * @property {boolean} [designTool] true for design / creative tools (omitted on software roles unless the posting mentions them)
 * @property {boolean} [prefill] true if added to a fresh profile with level null
 */

/** @type {CatalogSkill[]} */
export const SKILL_CATALOG = [
  // Core skills
  { name: 'Teamwork and collaboration', category: 'core', aliases: ['teamwork', 'collaboration', 'team player', 'collaborative'], prefill: true },
  { name: 'Time management', category: 'core', aliases: ['time-management', 'deadlines', 'punctual'], prefill: true },
  { name: 'Event management', category: 'core', aliases: ['event coordination', 'event planning', 'events management', 'managing events'], prefill: true },
  { name: 'People coordination', category: 'core', aliases: ['coordination', 'coordinating volunteers', 'volunteer coordination', 'people management'], prefill: true },
  { name: 'Communication', category: 'core', aliases: ['communication skills', 'verbal communication', 'written communication', 'good communicator'], prefill: true },
  { name: 'Leadership', category: 'core', aliases: ['leading teams', 'team lead', 'leader'], prefill: true },
  { name: 'Creativity', category: 'core', aliases: ['creative thinking', 'creative'], prefill: true },
  { name: 'Problem solving', category: 'core', aliases: ['problem-solving', 'analytical thinking', 'analytical skills'] },
  { name: 'Public speaking', category: 'core', aliases: ['presentation skills', 'presenting', 'anchoring'] },
  { name: 'Research', category: 'core', aliases: ['research skills', 'market research', 'user research'] },
  { name: 'Social media management', category: 'core', aliases: ['social media', 'instagram', 'content calendar', 'community management'] },
  { name: 'Attention to detail', category: 'core', aliases: ['detail-oriented', 'detail oriented', 'eye for detail'] },

  // Tools
  { name: 'DaVinci Resolve', category: 'tool', aliases: ['davinci', 'resolve', 'da vinci resolve'], designTool: true, prefill: true },
  { name: 'Figma', category: 'tool', aliases: ['figma design', 'figjam'], designTool: true, prefill: true },
  { name: 'Canva', category: 'tool', aliases: [], designTool: true, prefill: true },
  { name: 'Premiere Pro', category: 'tool', aliases: ['adobe premiere', 'premiere', 'adobe premiere pro'], designTool: true },
  { name: 'After Effects', category: 'tool', aliases: ['adobe after effects', 'motion graphics'], designTool: true },
  { name: 'Photoshop', category: 'tool', aliases: ['adobe photoshop'], designTool: true },
  { name: 'Illustrator', category: 'tool', aliases: ['adobe illustrator'], designTool: true },
  { name: 'Lightroom', category: 'tool', aliases: ['adobe lightroom'], designTool: true },
  { name: 'Adobe XD', category: 'tool', aliases: ['xd'], designTool: true },
  { name: 'CapCut', category: 'tool', aliases: ['cap cut'], designTool: true },
  { name: 'Blender', category: 'tool', aliases: ['blender 3d'], designTool: true },
  { name: 'OBS Studio', category: 'tool', aliases: ['obs'], designTool: true },
  { name: 'Colour grading', category: 'tool', aliases: ['color grading', 'colour correction', 'color correction'], designTool: true },
  { name: 'Video editing', category: 'tool', aliases: ['editing reels', 'reels editing', 'editing videos', 'editing short-form videos'], designTool: true },
  { name: 'Sound design', category: 'tool', aliases: ['audio editing', 'audio mixing'], designTool: true },
  { name: 'Typography', category: 'tool', aliases: ['type design', 'lettering'], designTool: true },
  { name: 'AI tools', category: 'tool', aliases: ['chatgpt', 'generative ai', 'gen ai', 'copilot', 'claude', 'gemini', 'midjourney'], prefill: true },
  { name: 'Excel', category: 'tool', aliases: ['ms excel', 'microsoft excel', 'spreadsheets', 'spreadsheet'] },
  { name: 'Google Sheets', category: 'tool', aliases: ['gsheets', 'google sheet'] },
  { name: 'PowerPoint', category: 'tool', aliases: ['ms powerpoint', 'microsoft powerpoint', 'google slides', 'presentations'] },
  { name: 'Google Workspace', category: 'tool', aliases: ['google docs', 'google drive', 'gsuite', 'g suite'] },
  { name: 'Notion', category: 'tool', aliases: [] },
  { name: 'Trello', category: 'tool', aliases: ['asana', 'jira'] },
  { name: 'WordPress', category: 'tool', aliases: ['wordpress cms'] },
  { name: 'Git/GitHub', category: 'tool', aliases: ['git', 'github', 'gitlab', 'version control'] },
  { name: 'VS Code', category: 'tool', aliases: ['visual studio code', 'vscode'] },
  { name: 'Postman', category: 'tool', aliases: [] },
  { name: 'Docker', category: 'tool', aliases: ['containers'] },
  { name: 'Firebase', category: 'tool', aliases: [] },
  { name: 'Supabase', category: 'tool', aliases: [] },

  // Programming
  { name: 'HTML', category: 'programming', aliases: ['html5'], prefill: true },
  { name: 'CSS', category: 'programming', aliases: ['css3', 'scss', 'sass'], prefill: true },
  { name: 'JavaScript', category: 'programming', aliases: ['js', 'es6', 'ecmascript', 'vanilla js'], prefill: true },
  { name: 'TypeScript', category: 'programming', aliases: ['ts'] },
  { name: 'React', category: 'programming', aliases: ['react.js', 'reactjs', 'react js'] },
  { name: 'Next.js', category: 'programming', aliases: ['nextjs', 'next js'] },
  { name: 'Node.js', category: 'programming', aliases: ['node', 'nodejs', 'node js', 'express', 'express.js'] },
  { name: 'Tailwind CSS', category: 'programming', aliases: ['tailwind', 'tailwindcss'] },
  { name: 'REST APIs', category: 'programming', aliases: ['rest api', 'rest', 'apis', 'api integration'] },
  { name: 'Python', category: 'programming', aliases: ['python3'], prefill: true },
  { name: 'C/C++', category: 'programming', aliases: ['c++', 'cpp', 'c programming', 'c language'], prefill: true },
  { name: 'Java', category: 'programming', aliases: ['core java'] },
  { name: 'SQL', category: 'programming', aliases: ['mysql', 'postgresql', 'postgres', 'sqlite', 'databases', 'database'] },
  { name: 'MongoDB', category: 'programming', aliases: ['mongo', 'nosql'] },
  { name: 'Flutter', category: 'programming', aliases: ['dart'] },
  { name: 'Kotlin', category: 'programming', aliases: ['android development', 'android'] },
  { name: 'Data structures and algorithms', category: 'programming', aliases: ['dsa', 'data structures', 'algorithms'] },
];

// ---------------------------------------------------------------------------
// Role families (SPEC section 4 and 10)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Family
 * @property {string} id
 * @property {string} label
 * @property {string[]} titles typical titles (title match scores x3)
 * @property {string[]} keywords description keywords (score x1)
 * @property {string[]} order full section order after the header
 * @property {'compact'|'normal'|'prominent'} education
 * @property {string[]} links default header links besides LinkedIn (always shown if present)
 */

/** @type {Family[]} */
export const FAMILIES = [
  {
    id: 'editing_video',
    label: 'Editing and Video',
    titles: ['video editor', 'reels editor', 'motion graphics', 'colourist', 'colorist', 'video editing', 'videographer', 'youtube editor', 'shorts editor', 'post-production'],
    keywords: ['davinci resolve', 'premiere', 'after effects', 'colour grading', 'color grading', 'reels', 'shorts', 'b-roll', 'footage', 'transitions', 'subtitles', 'capcut', 'filmora', 'youtube', 'video', 'editing', 'sound design'],
    order: ['about', 'skills', 'projects', 'experience', 'extracurriculars', 'education', 'achievements', 'hobbies', 'languages'],
    education: 'compact',
    links: ['portfolio'],
  },
  {
    id: 'design',
    label: 'Design',
    titles: ['graphic designer', 'ui/ux', 'ui designer', 'ux designer', 'ui ux', 'social media designer', 'thumbnail designer', 'product designer', 'visual designer', 'design intern', 'graphic design', 'designer'],
    keywords: ['figma', 'canva', 'photoshop', 'illustrator', 'typography', 'wireframe', 'wireframes', 'prototype', 'prototypes', 'mockup', 'mockups', 'branding', 'poster', 'posters', 'thumbnail', 'thumbnails', 'layout', 'colour palette', 'color palette', 'design system', 'logo', 'logos', 'visual design', 'creatives', 'graphics', 'illustrations'],
    order: ['about', 'skills', 'projects', 'experience', 'extracurriculars', 'education', 'achievements', 'hobbies', 'languages'],
    education: 'compact',
    links: ['portfolio'],
  },
  {
    id: 'software_web',
    label: 'Software and Web',
    titles: ['web developer', 'frontend', 'front-end', 'front end', 'backend', 'back-end', 'full stack', 'full-stack', 'software', 'developer', 'app tester', 'tech club', 'programmer', 'sde', 'engineer', 'qa intern', 'web development'],
    keywords: ['javascript', 'react', 'html', 'css', 'node', 'python', 'api', 'github', 'git', 'sql', 'database', 'debugging', 'deploy', 'typescript', 'next.js', 'testing', 'code', 'coding', 'programming'],
    order: ['about', 'skills', 'projects', 'experience', 'education', 'extracurriculars', 'achievements', 'hobbies', 'languages'],
    education: 'normal',
    links: ['github'],
  },
  {
    id: 'content_writing',
    label: 'Content and Writing',
    titles: ['content writer', 'copywriter', 'blog writer', 'scriptwriter', 'script writer', 'social media content', 'writer', 'editorial intern', 'technical writer', 'content intern', 'content creator'],
    keywords: ['blog', 'articles', 'copy', 'captions', 'seo', 'scripts', 'storytelling', 'proofreading', 'grammar', 'newsletter', 'content calendar', 'writing samples', 'writing', 'content'],
    order: ['about', 'projects', 'skills', 'experience', 'extracurriculars', 'education', 'achievements', 'hobbies', 'languages'],
    education: 'compact',
    links: ['portfolio'],
  },
  {
    id: 'operations_events',
    label: 'Operations and Events',
    titles: ['event coordinator', 'volunteer lead', 'operations intern', 'community manager', 'event manager', 'fest coordinator', 'operations', 'coordinator', 'ops intern', 'event management'],
    keywords: ['event', 'events', 'logistics', 'vendors', 'coordination', 'scheduling', 'volunteers', 'sponsorship', 'registration', 'hospitality', 'budget', 'planning', 'community', 'stakeholders', 'crowd management', 'on-ground'],
    order: ['about', 'experience', 'skills', 'achievements', 'extracurriculars', 'projects', 'education', 'hobbies', 'languages'],
    education: 'normal',
    links: [],
  },
  {
    id: 'general',
    label: 'General',
    titles: [],
    keywords: [],
    order: ['education', 'about', 'skills', 'experience', 'projects', 'achievements', 'extracurriculars', 'hobbies', 'languages'],
    education: 'prominent',
    links: [],
  },
];

// ---------------------------------------------------------------------------
// Tap-to-choose option lists
// ---------------------------------------------------------------------------

export const ORG_TYPES = [
  { id: 'startup', label: 'Startup' },
  { id: 'mid_size', label: 'Mid-size company' },
  { id: 'large', label: 'Large company or MNC' },
  { id: 'agency', label: 'Agency (creative, marketing, digital)' },
  { id: 'ngo', label: 'NGO or nonprofit' },
  { id: 'government', label: 'Government or PSU' },
  { id: 'research', label: 'Research lab or university department' },
  { id: 'campus', label: 'Campus club, society or fest' },
  { id: 'freelance_client', label: 'Freelance client or individual' },
  { id: 'creator', label: 'Content creator or YouTuber' },
  { id: 'other', label: 'Other' },
];

export const INDUSTRIES = [
  { id: 'technology', label: 'Technology and software' },
  { id: 'media', label: 'Media and entertainment' },
  { id: 'marketing', label: 'Marketing and advertising' },
  { id: 'design', label: 'Design and creative' },
  { id: 'education', label: 'Education and edtech' },
  { id: 'finance', label: 'Finance and fintech' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'ecommerce', label: 'E-commerce and retail' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'nonprofit', label: 'Nonprofit and social impact' },
  { id: 'government', label: 'Government and public sector' },
  { id: 'events', label: 'Events and hospitality' },
  { id: 'other', label: 'Other' },
];

/** Where the posting was found. `unverified` sources get the "Unverified source" caution. */
export const SOURCES = [
  { id: 'company_site', label: 'Company website' },
  { id: 'job_portal', label: 'Job portal' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'college', label: 'College or placement cell' },
  { id: 'referral', label: 'Referral' },
  { id: 'telegram_whatsapp', label: 'Telegram or WhatsApp', unverified: true },
  { id: 'email_dm', label: 'Email or DM', unverified: true },
  { id: 'other', label: 'Other' },
];

export const UNVERIFIED_SOURCE_CAUTION = 'Never pay a fee to apply. Verify the company independently before sharing documents.';

// ---------------------------------------------------------------------------
// Field helpers (SPEC section 12)
// ---------------------------------------------------------------------------

export const HOBBY_EXAMPLES = [
  { name: 'Reading', signal: 'Love of learning, focus' },
  { name: 'Writing or blogging', signal: 'Clear communication, organized thinking' },
  { name: 'Team sports (football, cricket, basketball)', signal: 'Teamwork, discipline, cooperation' },
  { name: 'Yoga or meditation', signal: 'Patience, stress management' },
  { name: 'Language learning', signal: 'Curiosity, willingness to grow' },
  { name: 'Photography or painting', signal: 'Creativity, attention to detail' },
  { name: 'Chess or puzzles', signal: 'Strategic thinking, problem-solving' },
  { name: 'Cooking', signal: 'Experimenting, planning' },
  { name: 'Cycling or trekking', signal: 'Endurance, consistency' },
  { name: 'Gaming (with a detail, e.g. "strategy games")', signal: 'Strategy, quick decisions' },
];

/** Hobbies that read as filler; the UI offers a soft suggestion when one is typed. */
export const FILLER_HOBBIES = ['listening to music', 'music', 'watching tv', 'watching movies', 'netflix', 'hanging out with friends', 'hanging out', 'sleeping', 'scrolling', 'browsing the internet', 'surfing the internet'];

export const FIELD_HELPERS = {
  hobbies: {
    label: 'Hobbies (optional, up to 4, 2 recommended)',
    definition: 'A hobby is a regular, hands-on activity you choose to do in your free time for fun or relaxation.',
    examples: HOBBY_EXAMPLES,
    tips: [
      'Keep it short (2-4 hobbies).',
      'Add a tiny detail, e.g. "Cooking (trying regional recipes)".',
      'Be honest; expect a casual question about it.',
      'Skip fillers like "listening to music", "watching TV" or "hanging out with friends".',
      'Volunteering belongs under Extracurriculars, not Hobbies.',
    ],
    max: 4,
    recommended: 2,
  },
  achievements: {
    label: 'Achievements (optional)',
    definition: 'Something you were recognized for or completed with a clear outcome.',
    examples: ['Competition placement (e.g. 2nd place, college hackathon)', 'Certificate with a named issuer', 'Scholarship', 'Selection into a program'],
    tips: ['Name the event or issuer.', 'Add the date if you remember it.', 'One line of detail is enough.'],
  },
  extracurriculars: {
    label: 'Extracurriculars (optional)',
    definition: 'Organized activities outside class.',
    examples: ['Club member or lead', 'Fest volunteer', 'NSS / NCC', 'Sports team', 'Community volunteering'],
    tips: ['Structured, recurring volunteering can go under Experience instead.', 'Mention your role, not only the club name.'],
  },
  aboutMe: {
    label: 'About Me (optional, 2-3 lines)',
    definition: 'A short, true introduction using only facts that are already in your profile.',
    maxChars: 300,
    structures: [
      '[Year] [degree] student with hands-on experience in [confirmed skill], seeking [role type] where I can [what you will contribute].',
      '[Degree] student who has [confirmed project or role] and enjoys [confirmed skill or interest]; looking for [role type] to [contribution].',
      '[Year]-year student at [institution] with [confirmed skill] and [confirmed skill], keen to [what you want to do] as a [role type].',
    ],
    tips: ['Keep it to about 300 characters.', 'Mention only skills you confirmed as "Have this".', 'Start with who you are, not with "I".'],
  },
};

// ---------------------------------------------------------------------------
// ATS checklist and templates (SPEC section 14)
// ---------------------------------------------------------------------------

export const ATS_CHECKLIST = [
  'Single-column layout for online portals.',
  'Avoid photos unless the country or employer expects them.',
  'Avoid tables, text boxes and multi-column layouts.',
  'Standard headings (Skills, Experience, Projects, Education).',
  'Standard fonts, body text 10.5 pt or larger.',
  'Contact details in the main body, not the page header or footer.',
  'No important text inside images or icons.',
  'No skill bars, dots, stars or percentage ratings.',
  'One consistent date format.',
  'Text-based PDF, not a scan or image.',
  'Posting keywords only for skills you genuinely have.',
  'Clear file name: Firstname-Lastname-Company-Role.pdf.',
];

/** Level words that may never be printed for any skill (integrity rule 2). */
export const BANNED_LEVEL_WORDS = ['proficient', 'expert', 'advanced', 'master', 'mastery', 'fluent in', 'ninja', 'guru', 'rockstar', 'highly skilled'];

/**
 * Templates. Only `text_first` is "Recommended"; the others are "Use with care" and trigger the warning popup.
 */
export const TEMPLATES = [
  { id: 'text_first', label: 'Text-first', columns: 1, graphics: 'none', colour: 'neutral', recommended: true, useWithCare: false, description: 'Single column, no photo, neutral colours, standard fonts.' },
  { id: 'text_accent', label: 'Text with accent colour', columns: 1, graphics: 'light', colour: 'accent', recommended: false, useWithCare: true, description: 'Single column with a coloured heading accent and light rules.' },
  { id: 'two_column', label: 'Two-column', columns: 2, graphics: 'light', colour: 'accent', recommended: false, useWithCare: true, description: 'Sidebar for skills and contact; may be misread by some applicant tracking systems.' },
  { id: 'two_column_photo', label: 'Two-column with photo', columns: 2, graphics: 'photo', colour: 'accent', recommended: false, useWithCare: true, description: 'Sidebar with photo. Photo conventions vary; use for direct applications to a person.' },
];

/** Fit trim order (SPEC section 13.1). */
export const TRIM_ORDER = ['hobbies', 'languages', 'extracurricular_item', 'entry_bullets', 'about'];

/** Standard section headings (SPEC section 11). */
export const SECTION_TITLES = {
  about: 'About Me',
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  achievements: 'Achievements',
  extracurriculars: 'Extracurriculars',
  hobbies: 'Hobbies',
  languages: 'Languages',
};

/** Canonical section order used when a family does not list a section. */
export const STANDARD_SECTION_ORDER = ['about', 'skills', 'experience', 'projects', 'education', 'achievements', 'extracurriculars', 'hobbies', 'languages'];

/** Indian cities used as a fallback for location detection. */
export const INDIAN_CITIES = ['Mumbai', 'Delhi', 'New Delhi', 'Bengaluru', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Gurugram', 'Gurgaon', 'Noida', 'Indore', 'Bhopal', 'Kochi', 'Coimbatore', 'Surat', 'Nagpur', 'Visakhapatnam', 'Bhubaneswar', 'Thiruvananthapuram', 'Mysuru', 'Vadodara', 'Patna', 'Dehradun', 'Goa', 'Mohali', 'Kanpur', 'Guwahati', 'Raipur', 'Ranchi'];

/**
 * Look up a catalog skill by canonical name or alias (case-insensitive).
 * @param {string} name
 * @returns {CatalogSkill|null}
 */
export function findCatalogSkill(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  for (const s of SKILL_CATALOG) {
    if (s.name.toLowerCase() === n) return s;
    if (s.aliases.some((a) => a.toLowerCase() === n)) return s;
  }
  return null;
}

/**
 * Find a family by id (falls back to General).
 * @param {string} id
 * @returns {Family}
 */
export function familyById(id) {
  return FAMILIES.find((f) => f.id === id) || FAMILIES[FAMILIES.length - 1];
}
