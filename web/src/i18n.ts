import type { DeliveryDetail, HeroState, Language, LogEntry, RunSummary, Status, TaskState } from './types'

type MessageKey =
  | 'observe'
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
  | 'hero_roster_summary'
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

const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  zh: {
    observe: '观测',
    open_observatory: '打开观测抽屉',
    observatory_open: '观测抽屉已打开',
    close_observatory: '关闭观测抽屉',
    observatory_title: '观测抽屉',
    return_galaxy: '返回星系',
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
    hero_roster_summary: '{total} · 本地 {local} · 远程 {remote}',
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
    live: '星海已接通',
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
  },
  en: {
    observe: 'Observe',
    open_observatory: 'Open observatory drawer',
    observatory_open: 'Observatory drawer is open',
    close_observatory: 'Close observatory drawer',
    observatory_title: 'Observatory Drawer',
    return_galaxy: 'Back to Galaxy',
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
    hero_roster_summary: '{total} · Local {local} · Remote {remote}',
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
    live: 'Sky link online',
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
