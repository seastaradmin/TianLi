import type { DeliveryDetail, HeroState, Language, LogEntry, RunSummary, Status, TaskState } from './types'

type MessageKey =
  | 'observe'
  | 'project_backstage'
  | 'backstage_short'
  | 'open_observatory'
  | 'observatory_open'
  | 'close_observatory'
  | 'observatory_title'
  | 'return_galaxy'
  | 'hero'
  | 'destiny_core'
  | 'current_destiny'
  | 'no_destiny'
  | 'routing_hero'
  | 'primary_hero'
  | 'consult_count'
  | 'consult_hero'
  | 'destiny_mode'
  | 'destiny_input_label'
  | 'destiny_placeholder'
  | 'pinned_heroes_label'
  | 'pinned_heroes_placeholder'
  | 'issue_destiny'
  | 'issuing_destiny'
  | 'destiny_ignited'
  | 'refresh_hero_sources'
  | 'main_monitor'
  | 'no_focus'
  | 'no_focus_copy'
  | 'dispatch'
  | 'waiting_verdict'
  | 'waiting_verdict_copy'
  | 'final_verdict'
  | 'judgment_input_label'
  | 'judgment_placeholder'
  | 'reject'
  | 'approve'
  | 'hero_roster'
  | 'hero_directory'
  | 'hero_roster_summary'
  | 'task_board'
  | 'task_related_heroes'
  | 'delivery_results'
  | 'deliverable_files'
  | 'deliverable_files_empty'
  | 'deliverable_files_loading'
  | 'deliverable_files_error'
  | 'download_file'
  | 'file_location'
  | 'updated_at'
  | 'delivery_result_empty'
  | 'delivery_summary_title'
  | 'delivery_team'
  | 'skill_contribution'
  | 'verdict_history'
  | 'no_verdict_history'
  | 'governance_board'
  | 'governance_clear'
  | 'evolution_patch'
  | 'region_feedback'
  | 'region_feedback_empty'
  | 'region_feedback_quiet'
  | 'latest_feedback'
  | 'region_task_load'
  | 'recovering_heroes'
  | 'focused_task_exits'
  | 'session_front'
  | 'active_sessions'
  | 'session_history'
  | 'session_stage_empty'
  | 'session_archive_empty'
  | 'local_cluster'
  | 'remote_cluster'
  | 'stats_and_flows'
  | 'trace_history'
  | 'sky_status'
  | 'active_destinies'
  | 'active_heroes'
  | 'early_exit_count'
  | 'no_logs'
  | 'latest_delivery_empty'
  | 'unlabeled_focus'
  | 'primary_lane'
  | 'consult_lane'
  | 'role_unlabeled'
  | 'skills'
  | 'heroes'
  | 'language_toggle'
  | 'switch_to_zh'
  | 'switch_to_en'
  | 'live'
  | 'offline'
  | 'hero_pending'
  | 'hover_hud'
  | 'galaxy_stage'
  | 'region_navigation'
  | 'jump_to_region'
  | 'load_snapshot_failed'
  | 'issue_destiny_failed'
  | 'verdict_submit_failed'
  | 'refresh_sources_success'
  | 'refresh_sources_failed'
  | 'collapse_destiny_console'
  | 'expand_destiny_console'
  | 'destiny_console_collapsed'

const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  zh: {
    observe: '观测',
    project_backstage: '项目后台',
    backstage_short: '后台',
    open_observatory: '打开观测后台',
    observatory_open: '观测后台已打开',
    close_observatory: '关闭观测后台',
    observatory_title: '观测后台',
    return_galaxy: '返回会话星系',
    hero: '英雄',
    destiny_core: '天命核',
    current_destiny: '当前天命：{title}',
    no_destiny: '当前未挂载天命',
    routing_hero: '命枢正在择星',
    primary_hero: '主星使：{hero}',
    consult_count: '协商 {count}',
    consult_hero: '协商 {hero}',
    destiny_mode: '天命模式',
    destiny_input_label: '输入新的天命',
    destiny_placeholder: '下达新的天命，命枢会把它化作流光送往群星…',
    pinned_heroes_label: '固定星使，使用逗号分隔',
    pinned_heroes_placeholder: '可选：固定星使，逗号分隔…',
    issue_destiny: '下达天命',
    issuing_destiny: '命枢受理中…',
    destiny_ignited: '天命已激发：{title}',
    refresh_hero_sources: '刷新星使来源',
    main_monitor: '主监察窗',
    no_focus: '暂无焦点',
    no_focus_copy: '选中一颗星或一道流光后，这里会展开它的观测剖面。',
    dispatch: '命枢分发',
    waiting_verdict: '等待裁决',
    waiting_verdict_copy: '主星使已提交结果，天理等待你的最终裁决。',
    final_verdict: '最终裁决',
    judgment_input_label: '输入裁决意见',
    judgment_placeholder: '写下你的裁决意见，若打回，命枢会带着这些意见重分发…',
    reject: '打回重分发',
    approve: '裁决通过',
    hero_roster: '星使名册',
    hero_directory: '全域星使名册',
    hero_roster_summary: '{total} · 本地 {local} · 远程 {remote}',
    task_board: '任务观测',
    task_related_heroes: '当前任务星使',
    delivery_results: '交付结果',
    deliverable_files: '产物文件',
    deliverable_files_empty: '输出目录里还没有可展示的产物文件。',
    deliverable_files_loading: '正在检索最新产物文件…',
    deliverable_files_error: '产物文件加载失败：{error}',
    download_file: '下载文件',
    file_location: '位置',
    updated_at: '更新于',
    delivery_result_empty: '当前任务还没有形成可读的交付结果。',
    delivery_summary_title: '交付摘要',
    delivery_team: '交付编队',
    skill_contribution: '技能贡献',
    verdict_history: '裁决回流',
    no_verdict_history: '当前还没有裁决记录。',
    governance_board: '天劫与天演',
    governance_clear: '本轮未触发天劫，暂无天演补丁。',
    evolution_patch: '天演补丁',
    region_feedback: '星域反馈',
    region_feedback_empty: '当前没有可用的星域反馈。',
    region_feedback_quiet: '暂无波动',
    latest_feedback: '最新反馈',
    region_task_load: '{tasks} 天命 · {heroes} 出征',
    recovering_heroes: '天演中的星使',
    focused_task_exits: '当前任务天劫',
    session_front: '会话前台',
    active_sessions: '激活会话',
    session_history: '会话历史',
    session_stage_empty: '当前没有激活中的会话，新的天命核会在会话启动后升起。',
    session_archive_empty: '暂无历史会话。',
    local_cluster: '本地星群',
    remote_cluster: '远域星群',
    stats_and_flows: '统计与链路',
    trace_history: '轨迹与历史',
    sky_status: '天象状态',
    active_destinies: '活跃天命',
    active_heroes: '出征星使',
    early_exit_count: '天劫次数',
    no_logs: '暂无新日志。',
    latest_delivery_empty: '新的交付完成后，这里会出现最新汇总。',
    unlabeled_focus: '未命名焦点',
    primary_lane: '主链',
    consult_lane: '协商',
    role_unlabeled: '未标注职责',
    skills: '{count} 个 skill',
    heroes: '{count} 位星使',
    language_toggle: '中 / EN',
    switch_to_zh: '切换为中文',
    switch_to_en: 'Switch to English',
    live: '已接通',
    offline: '离线观测中',
    hero_pending: '主星使待定',
    hover_hud: '节点速览',
    galaxy_stage: '天命星系',
    region_navigation: '星域导航',
    jump_to_region: '前往 {region}',
    load_snapshot_failed: '初始化快照失败：{error}',
    issue_destiny_failed: '天命下达失败：{error}',
    verdict_submit_failed: '裁决提交失败：{error}',
    refresh_sources_success: '远程星使来源已刷新',
    refresh_sources_failed: '刷新失败：{error}',
    collapse_destiny_console: '收起天命模式',
    expand_destiny_console: '展开天命模式',
    destiny_console_collapsed: '天命模式已收纳',
  },
  en: {
    observe: 'Observe',
    project_backstage: 'Project Backstage',
    backstage_short: 'Backstage',
    open_observatory: 'Open observatory backstage',
    observatory_open: 'Observatory backstage is open',
    close_observatory: 'Close observatory backstage',
    observatory_title: 'Observatory Backstage',
    return_galaxy: 'Back to Session Galaxy',
    hero: 'Hero',
    destiny_core: 'Destiny Core',
    current_destiny: 'Current destiny: {title}',
    no_destiny: 'No active destiny attached',
    routing_hero: 'The dispatcher is routing heroes',
    primary_hero: 'Primary hero: {hero}',
    consult_count: '{count} consult',
    consult_hero: 'Consult {hero}',
    destiny_mode: 'Destiny Mode',
    destiny_input_label: 'Input a new destiny',
    destiny_placeholder: 'Issue a new destiny, and the dispatcher will turn it into starlight for the galaxy…',
    pinned_heroes_label: 'Pinned heroes, comma separated',
    pinned_heroes_placeholder: 'Optional: pin heroes with commas…',
    issue_destiny: 'Issue Destiny',
    issuing_destiny: 'Dispatching…',
    destiny_ignited: 'Destiny ignited: {title}',
    refresh_hero_sources: 'Refresh Hero Sources',
    main_monitor: 'Main Monitor',
    no_focus: 'No Focus Yet',
    no_focus_copy: 'Select a star or a destiny core to unfold its observatory profile here.',
    dispatch: 'Dispatch',
    waiting_verdict: 'Awaiting Verdict',
    waiting_verdict_copy: 'The primary hero has delivered a result and is waiting for your final judgment.',
    final_verdict: 'Final Verdict',
    judgment_input_label: 'Enter your verdict',
    judgment_placeholder: 'Write your verdict. If you reject it, the dispatcher will reroute with your note…',
    reject: 'Reject & Redispatch',
    approve: 'Approve',
    hero_roster: 'Hero Roster',
    hero_directory: 'Hero Directory',
    hero_roster_summary: '{total} · Local {local} · Remote {remote}',
    task_board: 'Task Board',
    task_related_heroes: 'Task Heroes',
    delivery_results: 'Delivery Results',
    deliverable_files: 'Deliverable Files',
    deliverable_files_empty: 'No deliverable files are available in the output directories yet.',
    deliverable_files_loading: 'Loading the latest deliverable files…',
    deliverable_files_error: 'Failed to load deliverable files: {error}',
    download_file: 'Download file',
    file_location: 'Location',
    updated_at: 'Updated',
    delivery_result_empty: 'This task has not produced a readable delivery yet.',
    delivery_summary_title: 'Delivery Summary',
    delivery_team: 'Delivery Team',
    skill_contribution: 'Skill Contribution',
    verdict_history: 'Verdict Loop',
    no_verdict_history: 'No verdict history yet.',
    governance_board: 'TianJie & TianYan',
    governance_clear: 'No early exit was triggered in this round, and there is no evolution patch yet.',
    evolution_patch: 'Evolution Patch',
    region_feedback: 'Region Feedback',
    region_feedback_empty: 'No region feedback is available yet.',
    region_feedback_quiet: 'Quiet sky',
    latest_feedback: 'Latest feedback',
    region_task_load: '{tasks} destinies · {heroes} active',
    recovering_heroes: 'Recovering heroes',
    focused_task_exits: 'Focused task exits',
    session_front: 'Session Stage',
    active_sessions: 'Active Sessions',
    session_history: 'Session History',
    session_stage_empty: 'There are no active sessions right now. A destiny core will rise when a new session starts.',
    session_archive_empty: 'No session history yet.',
    local_cluster: 'Local Cluster',
    remote_cluster: 'Remote Cluster',
    stats_and_flows: 'Stats & Flows',
    trace_history: 'Trace & History',
    sky_status: 'Sky Status',
    active_destinies: 'Active Destinies',
    active_heroes: 'Active Heroes',
    early_exit_count: 'Early Exits',
    no_logs: 'No recent logs.',
    latest_delivery_empty: 'The latest delivery summary will appear here after the next completion.',
    unlabeled_focus: 'Unnamed focus',
    primary_lane: 'Primary',
    consult_lane: 'Consult',
    role_unlabeled: 'Unlabeled role',
    skills: '{count} skills',
    heroes: '{count} heroes',
    language_toggle: 'EN / 中',
    switch_to_zh: '切换为中文',
    switch_to_en: 'Switch to English',
    live: 'Connected',
    offline: 'Observing offline',
    hero_pending: 'Primary hero pending',
    hover_hud: 'Node quick view',
    galaxy_stage: 'Destiny galaxy',
    region_navigation: 'Region Navigation',
    jump_to_region: 'Jump to {region}',
    load_snapshot_failed: 'Failed to load the initial snapshot: {error}',
    issue_destiny_failed: 'Failed to issue destiny: {error}',
    verdict_submit_failed: 'Failed to submit verdict: {error}',
    refresh_sources_success: 'Remote hero sources refreshed',
    refresh_sources_failed: 'Refresh failed: {error}',
    collapse_destiny_console: 'Collapse destiny console',
    expand_destiny_console: 'Expand destiny console',
    destiny_console_collapsed: 'Destiny console stowed',
  },
}

const STATUS_LABELS: Record<Language, Record<string, string>> = {
  zh: {
    idle: '静止',
    issued: '已下达',
    routing: '路由中',
    consulting: '协商中',
    running: '执行中',
    synthesizing: '汇总中',
    judgment_pending: '待裁决',
    accepted: '已通过',
    rejected: '已打回',
    completed: '已完成',
    early_exit: '天劫',
    failed: '失败',
    recovering: '天演中',
    error: '异常',
  },
  en: {
    idle: 'Idle',
    issued: 'Issued',
    routing: 'Routing',
    consulting: 'Consulting',
    running: 'Running',
    synthesizing: 'Synthesizing',
    judgment_pending: 'Judgment Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    completed: 'Completed',
    early_exit: 'Early Exit',
    failed: 'Failed',
    recovering: 'Recovering',
    error: 'Error',
  },
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

export function t(language: Language, key: MessageKey, vars?: Record<string, string | number>) {
  return interpolate(MESSAGES[language][key], vars)
}

export function formatStatusLabel(status: Status | string, language: Language) {
  return STATUS_LABELS[language][status] ?? status
}

export function formatSkillCountLabel(count: number, language: Language) {
  if (language === 'en') {
    return `${count} skill${count === 1 ? '' : 's'}`
  }
  return t(language, 'skills', { count })
}

export function formatHeroCountLabel(count: number, language: Language) {
  if (language === 'en') {
    return `${count} hero${count === 1 ? '' : 'es'}`
  }
  return t(language, 'heroes', { count })
}

export function formatRoundLabel(round: number, language: Language) {
  return language === 'zh' ? `第 ${round} 轮` : `Round ${round}`
}

export function formatRoleLabel(role: 'primary' | 'consult', language: Language) {
  return role === 'primary' ? t(language, 'primary_lane') : t(language, 'consult_lane')
}

export function resolveHeroDisplayName(hero: Pick<HeroState, 'displayName' | 'displayNameZh' | 'displayNameEn'>, language: Language) {
  if (language === 'zh') {
    return hero.displayNameZh || hero.displayName || hero.displayNameEn || ''
  }
  return hero.displayNameEn || hero.displayName || hero.displayNameZh || ''
}

export function resolveHeroDescription(hero: Pick<HeroState, 'description' | 'descriptionZh' | 'descriptionEn'>, language: Language) {
  if (language === 'zh') {
    return hero.descriptionZh || hero.description || hero.descriptionEn || ''
  }
  return hero.descriptionEn || hero.description || hero.descriptionZh || ''
}

export function resolveDeliverySummary(item: Pick<TaskState, 'deliverySummary' | 'deliverySummaryZh' | 'deliverySummaryEn'> | Pick<RunSummary, 'deliverySummary' | 'deliverySummaryZh' | 'deliverySummaryEn'>, language: Language) {
  if (language === 'zh') {
    return item.deliverySummaryZh || item.deliverySummary || item.deliverySummaryEn || ''
  }
  return item.deliverySummaryEn || item.deliverySummary || item.deliverySummaryZh || ''
}

export function resolveDetailSummary(item: Pick<DeliveryDetail, 'summary' | 'summaryZh' | 'summaryEn'>, language: Language) {
  if (language === 'zh') {
    return item.summaryZh || item.summary || item.summaryEn || ''
  }
  return item.summaryEn || item.summary || item.summaryZh || ''
}

export function resolveLogMessage(log: Pick<LogEntry, 'msg' | 'msgZh' | 'msgEn'>, language: Language) {
  if (language === 'zh') {
    return log.msgZh || log.msg || log.msgEn || ''
  }
  return log.msgEn || log.msg || log.msgZh || ''
}
