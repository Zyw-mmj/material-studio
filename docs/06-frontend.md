# 第 6 步：前端页面与状态管理

## 1. 路由与组件

| 路由 | 内容 | 数据入口 | 交互边界 |
|---|---|---|---|
| `/templates` | 分类、模板卡片 | GET templates | 分类同步 URL query，支持直接进入 |
| `/templates/[id]` | 左侧详情/上传，右侧个人任务 | GET template、tasks(templateId)、ACTIVE | 根据 ID 重新取详情，不依赖前页内存 |
| `/history` | 当前用户历史、任务详情/结果 | GET tasks、task detail、ACTIVE | 游标分页；结果图片在当前身份下读取 |
| `/login` | 演示身份选择与范围说明 | csrf、login、me | 选择身份后通过导航进入模板或历史，不接受 redirect 参数 |
| `/` | 跳转 templates | 无 | 无个人缓存 |

App Router 的 page/layout 提供页面骨架；上传、任务列表、身份与轮询为 Client Components。个人 API 统一由浏览器同源调用，避免 Server Component 的共享缓存或未转发 Cookie 导致身份混淆。模板可服务端获取或客户端获取，但必须来自 Java，分类列表由 API 提供。

主要组件：TemplateFilter、TemplateCard、TemplateDetail、UploadSlots、UploadSlot、CreateTaskButton、TaskCard、TaskStepList、TaskResult、HistoryList、IdentityMenu。AuthProvider 统一维护身份和 epoch，页面级 TaskRegistry/轮询器只存活于当前页面。

## 2. 页面反馈与布局

| 区域 | 状态 | 展示/操作 |
|---|---|---|
| 模板 | 加载/成功/空/异常/无效 ID | 骨架、卡片、空提示、重试、返回列表 |
| 上传槽 | empty/uploading/ready/error | 选择、上传反馈、预览、替换/移除、失败重试 |
| 提交 | idle/submitting/uncertain | 创建按钮、提交中禁用、用原幂等键确认结果 |
| 任务 | QUEUED/RUNNING/SUCCEEDED/FAILED | 等待、真实阶段、结果图、失败阶段与原因 |
| 查询 | fresh/fetching/stale/notFound | 最近状态、刷新中、查询异常与重试、无权/不存在提示 |
| 历史 | 加载/空/列表/分页异常 | 占位、无历史、按时间排序、保留已有页并重试 |

桌面采用左侧制作区、右侧任务区；窄屏转为单列。图片限制在容器内等比缩放。状态不能只用颜色表示，需有文字/图标。失败原因可读，API 错误类型保留 requestId，界面显示用户可理解原因，不显示技术堆栈；当前未单独提供 requestId 展开面板。

采用语义按钮/输入、可见焦点、上传 input 的 label；图标移除按钮有 aria-label；错误关联 aria-describedby；阶段变化用低频 `aria-live="polite"` 通知，避免每次轮询都播报同一句话。320 px 宽度下关键操作可见，无页面级横向溢出。深色风格参考后来补充的 UI-01/02/03 主要布局，使用自制品牌与素材；不宣称像素复刻。实际 320px 与桌面检查见实施记录。

## 3. 状态分层

业务状态来自服务端，查询状态来自当前浏览器，二者分别保存：

```ts
type TaskStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
type StepName = 'VALIDATE' | 'GENERATE' | 'FINALIZE';
type StepStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
type QueryState = {
  isFetching: boolean;
  queryError: { message: string; requestId?: string } | null;
  lastSyncedAt: number | null;
};
// TaskDetail 类型从 OpenAPI 生成，避免另写一套漂移的响应模型。
// registry key = [authEpoch, userId, taskId]
```

网络超时只更新 QueryState，不能写入 `task.status='FAILED'`。没有成功快照时显示“暂时无法获取状态”；有旧快照时保留它，标注“状态暂时无法更新，上次同步于……”。仅当服务端返回业务 FAILED 才展示任务失败。

同任务的响应按 version 合并，低版本丢弃；摘要不能抹掉已加载的 steps/assets。相同 version 的摘要只补摘要字段，详情单独标记已加载。终态一旦收到，停止其自动查询；成功结果图片读取故障显示结果获取异常，不回改业务状态。

## 4. 上传与提交协议

每槽拥有 revision、AbortController、objectUrl 和成功 assetId。选择/替换图片时 revision+1，取消旧请求、清旧 assetId、释放旧 objectUrl，再创建本地预览。旧请求即使随后成功，只有 epoch 与 revision 仍一致才允许回写。

选择时检查文件大小、MIME 和槽数；上传至 Java 后再认可 assetId。`blob:` 地址只是临时预览，不能放进任务请求，也不能被历史恢复使用。移除、替换、卸载及身份变化都 revokeObjectURL。取消客户端上传不保证服务端没保存文件，允许留下未关联素材。

创建按钮仅在“身份有效、详情已加载、恰好 N 个 ready 槽、没有上传中、没有提交中/待确认提交”时可用。后端仍重复校验。

提交生命周期：

1. 冻结本次 templateId/有序 assetIds，生成 UUID 幂等键；立即切 submitting 并禁用按钮。
2. 202 后以 taskId 注册任务，补查详情；若已终态不启动轮询。清空本次上传槽，允许上传新素材创建其他任务。
3. 明确的 400/404 校验失败回到可修改状态；修改请求后生成新键。
4. 超时、断网、SUBMISSION_UNCERTAIN 时切 uncertain，保留冻结请求与原键，显示“提交结果待确认”。“确认提交结果”重发相同 POST；不得自动生成新键。
5. 认证失效清理当前页面个人数据；在同一身份重新登录后才可确认原提交。身份不同不携带前一用户的冻结请求。刷新后通过历史恢复已有任务；V1 不持久化浏览器上传草稿或待确认请求。

连续创建指不同任务；重试同一提交由幂等保证只有一条记录。V1 无“重新执行原失败任务”操作。

## 5. 多任务查询调度

采用自定义页面轮询器，无需额外状态库。实现时将状态合并、请求调度与 TaskCard 展示分离，卡片不各自创建无管理的 interval。

初次进入/刷新：

1. GET me 确定身份；读取当前作用域历史首页。
2. 用 `status=ACTIVE` 和相同 templateId 筛选分页取完未完成任务，合并到注册表。
3. 对这些 ID 补详情并调度，对历史中的终态仅按需读详情。
4. 新创建任务立即加入相同注册表，防止必须等下一次列表刷新才出现。

每个 taskId 只允许一个请求在途，采用“本次完成后 setTimeout 下一次”，禁止 setInterval 造成重叠。统一调度最多 4 个详情查询并发；等候队列也携带 epoch，卸载时整体清空。

| 情况 | 调度动作 |
|---|---|
| 200 + 非终态 | 接受新 version，2 秒后查询 |
| 200 + 终态 | 接受结果，删除 timer/controller/待调度项 |
| 超时/网络/5xx | 保留业务状态，2/4/8/16/30 秒退避，恢复成功后重置 |
| 401 | 取消所有个人请求、清空缓存，转身份入口 |
| 404 | 停止该 ID 自动查询，标注任务不存在/不可访问，不标业务 FAILED |
| 页面隐藏 | 暂停 timer，取消在途请求；保留当前快照 |
| 页面重新可见 | 先核验 me，再重新扫 ACTIVE 并同步已有非终态 |
| 页面卸载/路由切换 | 取消请求、timer、队列和可见性监听 |

实现采用 GET/提交超时 10 秒、上传 30 秒，为客户端策略而非后端 SLA。手动刷新可以跳过当前退避，但仍遵守同 ID 单请求在途。查询次数不影响后台处理速度或状态。

## 6. 防止旧请求和身份串扰

AuthProvider 在登录/退出/切换时增加 authEpoch，所有请求创建时捕获 epoch/userId。回写必须同时满足：组件仍挂载、epoch 未变、目标 taskId/slot revision 一致、响应 version 不低于现有值。AbortController 是资源清理手段，epoch 检查是最后的数据一致性屏障。

身份切换开始就隐藏任务/结果并清缓存，不能等待新请求完成后才清旧数据。切换失败显示未确认身份状态，通过 me 恢复，不能继续展示上个用户的私有图片。Cookie 不在 JS 中读取，也不写入 localStorage。

同浏览器标签共享会话 Cookie：通过 BroadcastChannel 广播“身份已变更”事件，各标签清状态并重新 GET me；事件不包含图片、Cookie 或 token。不支持 BroadcastChannel 时使用不含敏感数据的 storage 事件作为后备；可见性恢复时的 me 检查始终保留。

受保护图片使用同源 `<img>` 或禁用优化的图片组件，不走无用户会话的 Next.js 共享图片优化缓存。元素按 epoch/资源 ID 重新挂载，切换身份立刻卸载旧图片；结果和素材响应均 no-store。

## 7. 前端完成标准

同一页面三个任务可独立显示阶段与结果；终态不再产生自动请求；断开查询只出现 stale；刷新能发现历史首页之外的进行中任务；快速替换上传/切换身份/切页不会收到旧数据回写；小屏与键盘能完成模板选择、上传和提交。关键自动化场景见[测试方案](07-testing-and-acceptance.md)。
