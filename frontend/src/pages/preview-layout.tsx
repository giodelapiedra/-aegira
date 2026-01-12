/**
 * Layout Preview - ClickUp Style (Icon Rail + Context Sidebar + Full Content)
 * View this at: /preview-layout
 */

import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  CalendarX,
  Search,
  Clock,
  TrendingDown,
  TrendingUp,
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  ChevronDown,
  Eye,
  MessageSquare,
  UserCheck,
  XCircle,
  Users,
  BarChart3,
  Settings,
  Bell,
  Home,
  Activity,
  FileText,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

// Mock data
const SIDEBAR_ITEMS = [
  { id: 'checkins', label: "Today's Check-ins", icon: CheckCircle2, count: 24 },
  { id: 'sudden', label: 'Sudden Changes', icon: AlertTriangle, count: 3, urgent: true },
  { id: 'exemptions', label: 'Exemptions', icon: Shield, count: 5 },
  { id: 'absences', label: 'Absence Reviews', icon: CalendarX, count: 2 },
];

const ICON_RAIL = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'monitoring', icon: Activity, label: 'Monitoring', active: true },
  { id: 'team', icon: Users, label: 'Team' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'reports', icon: FileText, label: 'Reports' },
];

const ICON_RAIL_BOTTOM = [
  { id: 'notifications', icon: Bell, label: 'Notifications', badge: 3 },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'help', icon: HelpCircle, label: 'Help' },
];

const MOCK_CHECKINS = [
  { id: 1, name: 'Juan Dela Cruz', avatar: 'JD', status: 'ready', score: 92, time: '8:02 AM', trend: 'up', team: 'Engineering', email: 'juan@company.com' },
  { id: 2, name: 'Maria Santos', avatar: 'MS', status: 'limited', score: 65, time: '8:15 AM', trend: 'down', team: 'Design', email: 'maria@company.com' },
  { id: 3, name: 'Pedro Reyes', avatar: 'PR', status: 'ready', score: 88, time: '8:22 AM', trend: 'up', team: 'Engineering', email: 'pedro@company.com' },
  { id: 4, name: 'Ana Garcia', avatar: 'AG', status: 'not-ready', score: 45, time: '8:30 AM', trend: 'down', team: 'Marketing', email: 'ana@company.com' },
  { id: 5, name: 'Carlos Lopez', avatar: 'CL', status: 'ready', score: 95, time: '8:45 AM', trend: 'up', team: 'Engineering', email: 'carlos@company.com' },
  { id: 6, name: 'Sofia Mendoza', avatar: 'SM', status: 'limited', score: 72, time: '9:01 AM', trend: 'same', team: 'Support', email: 'sofia@company.com' },
  { id: 7, name: 'Miguel Torres', avatar: 'MT', status: 'ready', score: 85, time: '9:15 AM', trend: 'up', team: 'Sales', email: 'miguel@company.com' },
  { id: 8, name: 'Isabella Cruz', avatar: 'IC', status: 'ready', score: 90, time: '9:22 AM', trend: 'up', team: 'Engineering', email: 'isabella@company.com' },
];

const MOCK_SUDDEN = [
  { id: 1, name: 'Maria Santos', avatar: 'MS', from: 85, to: 52, time: '2 hours ago', reason: 'Stress spike detected', team: 'Design' },
  { id: 2, name: 'Ana Garcia', avatar: 'AG', from: 78, to: 45, time: '3 hours ago', reason: 'Sleep quality drop', team: 'Marketing' },
  { id: 3, name: 'Roberto Tan', avatar: 'RT', from: 90, to: 60, time: '4 hours ago', reason: 'Multiple factors', team: 'Operations' },
];

const MOCK_EXEMPTIONS = [
  { id: 1, name: 'Luis Ramos', avatar: 'LR', type: 'Medical', date: 'Jan 15-17', status: 'pending', team: 'Engineering' },
  { id: 2, name: 'Carmen Diaz', avatar: 'CD', type: 'Personal', date: 'Jan 16', status: 'pending', team: 'HR' },
  { id: 3, name: 'Rico Santos', avatar: 'RS', type: 'Training', date: 'Jan 18-19', status: 'pending', team: 'Sales' },
];

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'ready': return 'bg-green-50 text-green-700 border-green-200';
    case 'limited': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'not-ready': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const getStatusDot = (status: string) => {
  switch (status) {
    case 'ready': return 'bg-green-500';
    case 'limited': return 'bg-amber-500';
    case 'not-ready': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const getAvatarColor = (status: string) => {
  switch (status) {
    case 'ready': return 'bg-green-100 text-green-700';
    case 'limited': return 'bg-amber-100 text-amber-700';
    case 'not-ready': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export function PreviewLayoutPage() {
  const [activeCategory, setActiveCategory] = useState('checkins');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gray-50">
      {/* ========== ICON RAIL (Narrow Left) ========== */}
      <div className="w-16 bg-slate-900 flex flex-col items-center py-4 flex-shrink-0">
        {/* Logo */}
        <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center mb-6">
          <Activity className="w-5 h-5 text-white" />
        </div>

        {/* Main Nav */}
        <nav className="flex-1 flex flex-col items-center gap-1">
          {ICON_RAIL.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all group relative
                  ${item.active
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                {item.active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Nav */}
        <div className="flex flex-col items-center gap-1 pt-4 border-t border-slate-700">
          {ICON_RAIL_BOTTOM.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all relative"
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========== CONTEXT SIDEBAR ========== */}
      <aside className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-60'}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Monitoring</h2>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeCategory === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveCategory(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                  ${isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                  ${item.urgent && !isActive ? 'bg-red-100 text-red-700' : ''}
                  ${isActive ? 'bg-primary-200 text-primary-800' : 'bg-gray-100 text-gray-600'}
                `}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Quick Stats */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Today's Summary</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg p-2 text-center border border-gray-100">
              <p className="text-lg font-bold text-green-600">18</p>
              <p className="text-xs text-gray-500">Ready</p>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-gray-100">
              <p className="text-lg font-bold text-amber-600">6</p>
              <p className="text-xs text-gray-500">Limited</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ========== MAIN CONTENT (Full Width) ========== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Content Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <PanelLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {SIDEBAR_ITEMS.find(i => i.id === activeCategory)?.label}
                </h1>
                <p className="text-sm text-gray-500">
                  {activeCategory === 'checkins' && 'View all team member check-ins for today'}
                  {activeCategory === 'sudden' && 'Members with significant score changes'}
                  {activeCategory === 'exemptions' && 'Pending exemption requests'}
                  {activeCategory === 'absences' && 'Absences requiring review'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">⌘F</span>
              </div>

              {/* Filter */}
              <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                <Filter className="w-4 h-4" />
                Filter
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* View Toggle */}
              <div className="flex items-center border border-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ===== CHECK-INS VIEW ===== */}
          {activeCategory === 'checkins' && viewMode === 'table' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Team</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                    <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trend</th>
                    <th className="w-20 px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_CHECKINS.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-all border-l-2 border-l-transparent hover:border-l-primary-500 ${index !== MOCK_CHECKINS.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium ${getAvatarColor(item.status)}`}>
                            {item.avatar}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{item.team}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(item.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(item.status)}`}></span>
                          {item.status === 'ready' ? 'Ready' : item.status === 'limited' ? 'Limited' : 'Not Ready'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700">
                          {item.score}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {item.time}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500 mx-auto" />}
                        {item.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500 mx-auto" />}
                        {item.trend === 'same' && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Message">
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===== CHECK-INS GRID VIEW ===== */}
          {activeCategory === 'checkins' && viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {MOCK_CHECKINS.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold ${getAvatarColor(item.status)}`}>
                      {item.avatar}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(item.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(item.status)}`}></span>
                      {item.status === 'ready' ? 'Ready' : item.status === 'limited' ? 'Limited' : 'Not Ready'}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{item.team}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-2xl font-bold text-gray-900">{item.score}%</span>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== SUDDEN CHANGES VIEW ===== */}
          {activeCategory === 'sudden' && (
            <div className="space-y-4">
              {MOCK_SUDDEN.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-amber-200 p-5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-base font-semibold text-amber-700">
                      {item.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <p className="text-sm text-gray-500">{item.team} • {item.time}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-gray-400 line-through">{item.from}%</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-lg font-bold text-red-600">{item.to}%</span>
                            </div>
                            <p className="text-xs text-red-600">-{item.from - item.to} points</p>
                          </div>
                          <TrendingDown className="w-6 h-6 text-red-500" />
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <p className="text-sm text-amber-800">
                          <strong>Detected:</strong> {item.reason}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                          Contact Member
                        </button>
                        <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                          View Profile
                        </button>
                        <button className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===== EXEMPTIONS VIEW ===== */}
          {activeCategory === 'exemptions' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Member</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_EXEMPTIONS.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-all border-l-2 border-l-transparent hover:border-l-primary-500 ${index !== MOCK_EXEMPTIONS.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700">
                            {item.avatar}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.team}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.date}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Pending
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="Approve">
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Reject">
                            <XCircle className="w-4 h-4" />
                          </button>
                          <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===== ABSENCES VIEW ===== */}
          {activeCategory === 'absences' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <CalendarX className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">2 Absences to Review</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                Same table format as exemptions - showing pending absence justifications
              </p>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <footer className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-gray-500">
            Showing {activeCategory === 'checkins' ? MOCK_CHECKINS.length : activeCategory === 'sudden' ? MOCK_SUDDEN.length : MOCK_EXEMPTIONS.length} items
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-gray-600">Ready: 18</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-gray-600">Limited: 4</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-gray-600">Not Ready: 2</span>
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
