const fs = require('fs');
const path = require('path');

const targetFiles = [
  'src/app/about/page.js',
  'src/app/features/page.js',
  'src/app/technology/page.js',
  'src/app/team/page.js',
  'src/app/faq/page.js',
  'src/app/terms/page.js',
  'src/app/privacy/page.js',
  'src/app/api/rag/chat/route.js',
  'src/app/api/rag/flashcards/route.js',
  'src/app/api/rag/mcq/route.js',
  'src/app/api/rag/summary/route.js',
  'src/components/AuthCharacters.jsx'
];

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.warn('File not found:', file);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace StudyCord -> StudyGuru
  content = content.replace(/StudyCord/g, 'StudyGuru');
  
  // Replace domain studycord.me -> studyguru.me
  content = content.replace(/studycord\.me/g, 'studyguru.me');

  // Replace schema or lower ids studycord -> studyguru in these public / docs files
  if (file.includes('src/app/about') || file.includes('src/app/features') || file.includes('src/app/technology') || file.includes('src/app/team') || file.includes('src/app/faq') || file.includes('src/app/terms') || file.includes('src/app/privacy')) {
    content = content.replace(/studycord-page-schema/g, 'studyguru-page-schema');
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  } else {
    console.log('No changes needed:', file);
  }
});

console.log('Rebrand completed across target files.');
