// 生成首页代码独立预览页（完整 HTML + 注入 jQuery）
import fs from 'node:fs';

const tmpl = fs.readFileSync('g:/酒馆/tavern_helper_template-main/dist/变量结构与状态栏代码/首页代码', 'utf8')
  .replace(/^```html\s*\n/, '')
  .replace(/\n```\s*$/, '');

const page = tmpl.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js"></script>\n</head>');

fs.writeFileSync('g:/酒馆/tavern_helper_template-main/_预览_首页代码.html', page, 'utf8');
console.log('已生成 _预览_首页代码.html, 长度', page.length);
