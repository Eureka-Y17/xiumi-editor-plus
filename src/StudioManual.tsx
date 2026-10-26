import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Play, Pause } from "lucide-react";
type Chapter = {
  id: string;
  title: string;
  intro: string;
  steps: string[];
  note?: string;
  demo?: string;
};
const chapters: Chapter[] = [
  {
    id: "start",
    title: "开始使用",
    intro:
      "秀米 PLUS 是运行在浏览器里的本地图文精修工作台。导入秀米发布用图文后，在这里选组件、调排版、组合移动，再复制到公众号。",
    steps: [
      "从 GitHub Releases 下载 chrome.zip，完整解压到固定文件夹。",
      "在 Chrome 或 Edge 的扩展管理页开启“开发者模式”，选择“加载已解压的扩展程序”，定位到包含 manifest.json 的文件夹。",
      "点击扩展图标 → 打开精修工作台。默认自制文章可以直接练习。左侧是草稿和结构树，中间是正文，右侧是组件属性。",
      "升级前点击“备份工程”。把新版解压到原安装位置，在扩展管理页点“重新加载”，然后刷新编辑台。",
    ],
    note: "普通编辑、工程备份、电脑预览和复制图文都不需要启动本机服务。",
  },
  {
    id: "import",
    title: "导入图文与工程",
    intro: "编辑的是本地副本，秀米原稿不会被覆盖。",
    steps: [
      "在秀米打开图文，点“导出”，按页面提示复制整篇内容。",
      "回到工作台点“粘贴导入”，在输入区按 Ctrl+V（Mac 为 ⌘+V）。保留富文本，不要用纯文本粘贴。",
      "核对文章首尾、图片、背景、文字和链接，等待顶部提示“已保存在本机”。",
      "“打开工程”支持 .xep.json 工程和 HTML。工程保留组合、画布与锁定等编辑状态，适合继续修改。",
    ],
    note: "来源剪贴板没有包含的字体、互动或图片无法自动恢复。失效图片可换成本地文件。",
  },
  {
    id: "select",
    title: "选择与长按框选",
    intro: "短按选单个；长按约半秒再拖动，可以一次选择区域里的最大层组件。",
    steps: [
      "单击正文组件，左侧结构树会展开父层并滚动到对应位置。也可以直接点树节点，或在“结构”分类里选择父层、子层。",
      "在正文或中间空白画布按住鼠标左键约 0.45 秒，不要立即移动。出现青绿色选择框后，再拖动并松开。",
      "只有完全进入矩形的组件会被框选。父组件完整进入时，只选择父组件，不重复选内部文字和图片；只框住内部组件时选择这些子项。",
      "从右下往左上拖也可以框选。按住 Ctrl / ⌘ 或 Shift 框选会保留原选项；Esc 取消当前框选。",
      "锁定组件不会被框选。长按前立即拖动仍是原来的组件移动；选框把手可以直接拖动，不必长按。",
    ],
    note: "组合要求同一父容器。框选跨容器的组件后，可先通过结构树确认层级；不能把父子嵌套重复组合。",
    demo: "select",
  },
  {
    id: "move",
    title: "排序、拖动与组合",
    intro: "普通文章按顺序排版，自由画布按坐标摆放。",
    steps: [
      "普通组件：拖动选框上方的小把手，移到目标前后提示线再松开，改变正文顺序。",
      "“向前移动 / 向后移动”优先交换当前同级；没有同级时才寻找外层包装。父容器是横排时，同级交换会改变左右顺序。",
      "左侧树支持拖放排序；按 Alt 拖放可以移入允许的容器。不能把组件放到自己内部或拖出表格单元格。",
      "按 Ctrl / ⌘ 多选同级组件后点“组合”，即可作为一块选择与移动；“取消组合”恢复内部内容。",
      "在右侧“结构”里可提升内容一层、拆除支持的普通单列外壳。复杂互动和特殊结构内部不支持拆分。",
    ],
    note: "含 SVG 的完整块可以原样排序，SVG 内部仍不直接编辑。",
    demo: "group",
  },
  {
    id: "layer",
    title: "图层与位置对齐",
    intro: "父子层级表示“包含”，图层顺序表示“谁盖住谁”，两者分别操作。",
    steps: [
      "默认文章有沙色背景板和绿色文字卡片。在左树选文字卡片，去“顺序”页点置底或置顶，观察遮挡变化。",
      "只有同父容器且存在重叠关系的普通组件，才能调整前后遮挡。要自由放置，在“布局”里转换为叠放画布。",
      "画布中的文字、图片、背景板和组合都能直接拖动 X/Y；“位置”分类可以填坐标和尺寸，拖右下角把手可以缩放。",
      "“组件靠左 / 水平居中 / 靠右”以父容器为参照移动整个组件。满宽组件需先缩小宽度。垂直对齐需要自由画布。",
      "“文字”页的段落左中右对齐只改变文字排版。“位置”页还可调旋转和透明度。已在目标位置时按钮禁用并说明原因。",
    ],
    note: "普通组件左右位移保留原文流占位；移动较多时可能与其他内容相遇。随时 Ctrl+Z 恢复。",
    demo: "layers",
  },
  {
    id: "text",
    title: "文字编辑与插入",
    intro: "文字内容、选区样式和组件位置可以分别调整。",
    steps: [
      "选中文字段，右侧“文字 → 编辑内容”修改，点“应用文字”。未应用的输入不会改变正文。",
      "双击文字打开富文本编辑器。选中文字后设置加粗、斜体、下划线、删除线、颜色和链接，应用后返回文章。",
      "“文字 → 字体与排版”调整字体、字号、行高、字间距、首行缩进和段落对齐。字体实际显示取决于设备已安装的字体。",
      "顶部“文字”或左侧“插入”默认在选中文章块下方插入，避开横排模板内部，不把原文字挤到旁边。",
      "“结构”页可前插或后插空行。想把新文字放进叠放画布，先选画布，再在“布局”页点“在此画布内添加文字”。",
    ],
    note: "Ctrl+Z 撤销已应用的文章修改；仍在输入、尚未应用的文字先使用输入框自己的撤销。",
    demo: "text",
  },
  {
    id: "style",
    title: "颜色、图片与容器",
    intro: "右侧属性顶部按顺序、位置、布局、色彩、文字、图片、链接、结构分类。",
    steps: [
      "在“色彩”选择背景、文字或边框目标，再点经典色、系统调色板或填颜色值。经典八色可直接点选。",
      "父组件颜色可能被子组件自己的颜色覆盖。要改具体文字或背景，先选到对应层。可清除背景图或设置透明背景。",
      "左侧或顶部插入本地图片；选中图片后在“图片”页替换、调整裁切和尺寸。在“链接”页设置或移除 HTTPS 链接。",
      "“布局”可设置纵排、横排、双列或三列，调整间距、内外边距；“色彩”可调整边框宽度与圆角。",
      "模板中的空布局可能只是装饰或占位，删除前先备份并核对效果。表格支持单元格文字，暂不支持复杂跨格合并。",
    ],
  },
  {
    id: "save",
    title: "保存、撤销与备份",
    intro: "草稿自动保存到当前浏览器，工程文件用于可靠备份和跨设备继续编辑。",
    steps: [
      "修改后等顶部“已保存在本机”。左上角草稿列表切换文章，旁边 + 可新建草稿。",
      "Ctrl+Z / ⌘+Z 撤销；Ctrl+Shift+Z / ⌘+Shift+Z 或 Ctrl+Y 重做。顶部也有撤销、重做按钮。",
      "点击“备份工程”下载 .xep.json，包含正文与可编辑结构；下次点“打开工程”继续。",
      "卸载扩展、清理浏览器数据、改变扩展 ID 或换电脑，都可能让原本的本机草稿不可访问。重要文章请额外下载工程。",
      "“下载 HTML”适合交付副本；“打印 / PDF”适合留存阅读外观。它们不能代替可继续分层编辑的工程。",
    ],
  },
  {
    id: "preview",
    title: "第一次连接与手机二维码",
    intro:
      "手机不能打开浏览器扩展的内部页面，所以需要电脑临时提供一个预览地址。这个小服务仅在你的电脑运行。",
    steps: [
      "先点顶部“预览 / 二维码”：电脑预览可以直接使用，无需连接。",
      "需要手机扫码时，去 GitHub 发布页下载与扩展同版本的 local-service.zip，解压到普通文件夹。不要只在压缩包里双击。",
      "安装 Node.js 24 或更新版本，安装后双击服务文件夹里的 start-preview.cmd。第一次会联网准备依赖，请等待显示“配对码”。",
      "保持这个服务窗口开着，把“配对码”复制到工作台“连接与同步 → 本机配对码”，点“连接本地服务”，出现浏览器权限请求时允许。",
      "让手机与电脑连到同一 Wi-Fi。在“手机预览”选择局域网地址（不是 127.0.0.1），再点“生成预览二维码”。",
      "用手机扫码。链接一小时后过期，也可以主动撤销。修改文章后需重新生成二维码，旧链接内容不会自动更新。",
    ],
    note: "这是临时网页排版预览，不是微信官方预览。关闭服务窗口、电脑休眠或手机换网络后，手机可能无法打开。不要把本机配对码发给他人。",
  },
  {
    id: "deliver",
    title: "复制到公众号与草稿同步",
    intro: "复制粘贴无需配置账号接口；一键新建公众号草稿是可选高级功能。",
    steps: [
      "完成编辑后点“复制到公众号”，到公众号后台正文编辑区粘贴，并检查图片、文字、链接和排版。",
      "自由叠放或图片背景区域在交付副本中合成图片，以保留外观；这些区域内的文字、链接和互动不再分别可编辑。本地工程仍保留分层。",
      "需要一键新建草稿时，先连接本机服务，再在“连接与同步”填写有权限的公众号 AppID、AppSecret 和封面素材信息，按提示配置 IP 白名单。",
      "AppSecret 只保留在本机服务内存中。重启服务后需要重新配置；不要把凭据写入工程或问题反馈。",
      "同步只新建草稿，不群发、不发布、不覆盖秀米原稿。没有接口权限时，使用复制粘贴即可。",
    ],
    note: "真实公众号接口与 iOS/Android 微信效果仍需账号实测。不提供自动回写秀米原稿的承诺；官方 HTML 导入需遵循其权限要求。",
  },
  {
    id: "trouble",
    title: "常见问题与快捷键",
    intro: "先判断是选择层级、布局空间，还是服务连接问题。",
    steps: [
      "移动按钮不可用：检查当前是否第一/最后一项、组件是否锁定、是否选在画布或表格内部。到“结构”选父层再操作。",
      "颜色没变：检查选中的层是否正是可见颜色来源，子层可能覆盖父层颜色。",
      "手机打不开二维码：确认服务窗口仍在、同一 Wi-Fi、选择了局域网地址；允许系统防火墙的专用网络访问。校园网隔离或 VPN 可能阻止访问。",
      "连接失败：确认服务启动完成、配对码没有复制空格、旧服务窗口没有关闭。重启服务后使用新的配对码重连。",
      "快捷键：Ctrl/⌘+G 组合，Ctrl/⌘+Shift+G 取消组合，Ctrl/⌘+D 复制，Delete 删除，Esc 取消选择/框选；画布内方向键移动 1px，Shift+方向键移动 10px。",
      "提交问题时附上操作步骤、浏览器版本与脱敏工程。工程可能包含私人文字和图片地址，请先检查。",
    ],
  },
];
function Demo({ name }: { name: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className="st-manual-demo">
      <button
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? "暂停动图" : "播放动图"}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
        {playing ? "暂停演示" : "播放实际操作演示"}
      </button>
      <img
        src={`/guide/${name}.${playing ? "gif" : "png"}`}
        alt="编辑台实际操作演示"
      />
      <figcaption>
        自制演示文章，实际编辑台操作录制；可随时暂停。{" "}
        <a href={`/guide/${name}.gif`} target="_blank" rel="noreferrer">
          放大查看 ↗
        </a>
      </figcaption>
    </figure>
  );
}
export function StudioManual({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState("start");
  const content = useRef<HTMLDivElement>(null),
    back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    back.current?.focus();
    return () => old?.focus();
  }, []);
  const chapter = chapters.find((c) => c.id === id)!;
  return (
    <div
      className="st-manual"
      data-st-manual="true"
      role="dialog"
      aria-modal="true"
      aria-label="操作手册"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const items = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>("button,a[href]"),
          );
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <header>
        <div>
          <BookOpen size={22} />
          <strong>操作手册</strong>
          <span>从导入到交付，一步一步来</span>
        </div>
        <button ref={back} onClick={onClose}>
          <ArrowLeft size={16} />
          返回编辑台
        </button>
      </header>
      <div className="st-manual-layout">
        <nav aria-label="手册目录">
          {chapters.map((c, i) => (
            <button
              key={c.id}
              aria-current={id === c.id ? "page" : undefined}
              onClick={() => {
                setId(c.id);
                content.current?.scrollTo(0, 0);
              }}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              {c.title}
            </button>
          ))}
          <a
            href="https://github.com/Eureka-Y17/xiumi-editor-plus/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noreferrer"
          >
            查看版本更新记录 ↗
          </a>
        </nav>
        <div className="st-manual-content" ref={content}>
          <article key={id}>
            <small>秀米 PLUS · 使用指南</small>
            <h1>{chapter.title}</h1>
            <p className="st-manual-intro">{chapter.intro}</p>
            <ol>
              {chapter.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {chapter.note && <aside>{chapter.note}</aside>}
            {chapter.demo && <Demo name={chapter.demo} />}
          </article>
        </div>
      </div>
    </div>
  );
}
