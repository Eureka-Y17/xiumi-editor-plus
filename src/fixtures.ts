const picture = (color: string, accent: string, title: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${color}"/><circle cx="470" cy="120" r="150" fill="${accent}"/><path d="M0 480L180 160 370 480ZM230 480L460 230 640 480Z" fill="#254d40" opacity=".75"/><text x="40" y="420" font-size="30" fill="#fff" font-family="sans-serif">${title}</text></svg>`)}`;
export const imageA = picture("#b3c5ac", "#efdab1", "MOUNTAIN / 01");
export const imageB = picture("#a7bfc0", "#e6e8d3", "COAST / 02");
export interface Fixture {
  name: string;
  description: string;
  html: string;
}
const single = (body: string, attrs = "") =>
  `<section data-label="单列卡片" data-xep-layout="single" ${attrs}>${body}</section>`;
const imgs = `<img data-label="山间来信" alt="山间来信" src="${imageA}" style="width:100%;height:180px;object-fit:cover;border-radius:10px"><img data-label="海边日记" alt="海边日记" src="${imageB}" style="width:100%;height:180px;object-fit:cover;border-radius:10px">`;
export const fixtures: Fixture[] = [
  {
    name: "山野来信",
    description: "完整图文 · 选择与排序",
    html: `<p class="eyebrow">FIELD NOTES / VOL. 01</p><h1>把日子，交给山野。</h1><p class="lede">偶尔慢下来，听见生活原本的声音。</p>${single(`<div data-label="并排双图" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${imgs}</div><p>沿着小路走进清晨。树影落在肩上，风把所有琐事轻轻吹远。</p>`, 'style="background:#f0f4ed;padding:20px;border-radius:14px"')}<h2>01 / 留一点空白</h2><p>不必急着抵达。此刻的阳光、草木与呼吸，都值得认真收藏。</p><blockquote>“生活的诗意，藏在每一个普通的今天。”</blockquote><p><a href="https://example.com" target="_blank" rel="noreferrer">阅读手记 ↗</a></p>`,
  },
  {
    name: "普通图文",
    description: "文字与图片混排",
    html: `<h1>平凡的一天</h1><p>这是一段可以选择、排序的文字。</p>${imgs}<p>结束段落，保留原始内容。</p>`,
  },
  {
    name: "单列拆组",
    description: "移除容器，保留内容",
    html: `<h1>拆开一张卡片</h1>${single("<h2>卡片标题</h2><p>拆组后这段文字依然存在。</p>")}<p>卡片之外的内容。</p>`,
  },
  {
    name: "并排双图",
    description: "交换素材，保留裁切",
    html: `<h1>山与海之间</h1><div data-label="双列布局" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${imgs}</div>`,
  },
  {
    name: "多层嵌套",
    description: "选择父层与提升元素",
    html: `<h1>层层展开</h1>${single(single("<h2>里面的标题</h2><p>将我提升一层试试看。</p>"))}<p>外面的段落。</p>`,
  },
  {
    name: "背景卡片",
    description: "拆组前查看样式提示",
    html: `<h1>关于一片森林</h1>${single("<h2>绿色的记忆</h2><p>背景和间距属于外壳，拆组后将消失。</p>", 'style="background:#dce9de;padding:28px;border:1px solid #9cbaa7"')}`,
  },
  {
    name: "重叠图层",
    description: "同级图层顺序调整",
    html: `<h1>让层次清晰可见</h1><div data-label="重叠画板" data-xep-overlap style="position:relative;height:290px"><div data-label="苔绿卡片" style="position:absolute;left:15px;top:15px;background:#91ac92;width:65%;height:170px;padding:20px;z-index:1">森林 / FOREST</div><div data-label="沙色卡片" style="position:absolute;left:105px;top:95px;background:#e3cda9;width:65%;height:170px;padding:20px;z-index:2">原野 / FIELD</div></div>`,
  },
  {
    name: "滑动组件",
    description: "特殊组件修改拦截",
    html: `<h1>保护交互结构</h1><div data-label="滑动序列（只读）" data-xep-special style="padding:20px;background:#e7ece8">${imgs}</div><p>普通段落仍可选择。</p>`,
  },
  {
    name: "SVG 组件",
    description: "识别特殊组件与嵌套",
    html: `<h1>交互内容保持只读</h1><section data-label="SVG 卡片"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 180"><rect width="400" height="180" rx="18" fill="#bfd5c9"/><text x="30" y="100" font-size="22">SVG · 仅查看结构</text></svg></section>`,
  },
  {
    name: "长文章",
    description: "100 段结构定位",
    html: `<h1>一百个生活片段</h1>${Array.from({ length: 100 }, (_, i) => `<p data-label="段落 ${i + 1}">${i + 1}. 每一段文字都应该能被清楚看见，轻松找到。</p>`).join("")}`,
  },
  {
    name: "链接与列表",
    description: "拆组后保持语义完整",
    html: `<h1>出发清单</h1>${single('<ul><li>带上相机</li><li><a href="https://example.com">查看路线</a></li></ul><p>保留文字、链接与列表。</p>')}`,
  },
];
