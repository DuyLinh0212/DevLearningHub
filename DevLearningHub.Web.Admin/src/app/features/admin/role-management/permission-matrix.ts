import { PermissionItem, PermissionModule } from '../../../core/services/roles.service';

// View models for the role permission matrix (plan section 9).
// Rows are resource/modules, columns are action suffixes in a fixed order.
// Cells only exist where a real permission is present in the catalog — no
// synthetic permissions are invented to fill the grid.

export interface PermissionMatrixColumn {
  // Action suffix, e.g. 'view', 'edit_own', 'full_control'.
  action: string;
  // Vietnamese column header.
  label: string;
}

export interface PermissionMatrixCell {
  // The real permission this cell toggles, or null if no such permission exists.
  permission: PermissionItem | null;
}

export interface PermissionMatrixRow {
  // Resource/module key, e.g. 'post', 'system'.
  module: string;
  // Vietnamese row header.
  label: string;
  // One cell per column in the matrix, aligned by column index.
  cells: PermissionMatrixCell[];
}

// Fixed column order (plan section 9.2).
const ACTION_ORDER: PermissionMatrixColumn[] = [
  { action: 'view', label: 'Xem' },
  { action: 'view_all', label: 'Xem tất cả' },
  { action: 'view_progress', label: 'Xem tiến độ' },
  { action: 'create', label: 'Thêm mới' },
  { action: 'edit', label: 'Chỉnh sửa' },
  { action: 'edit_own', label: 'Sửa của mình' },
  { action: 'edit_any', label: 'Sửa tất cả' },
  { action: 'delete', label: 'Xóa' },
  { action: 'delete_any', label: 'Xóa tất cả' },
  { action: 'hide', label: 'Ẩn' },
  { action: 'hide_any', label: 'Ẩn / hiện lại' },
  { action: 'review', label: 'Duyệt' },
  { action: 'ban', label: 'Khóa' },
  { action: 'assign_permission', label: 'Gán quyền' },
  { action: 'access', label: 'Truy cập' },
  { action: 'full_control', label: 'Toàn quyền' }
];

// Vietnamese labels for resource/module rows (plan section 9.1).
const MODULE_LABELS: Record<string, string> = {
  post: 'Bài đăng',
  comment: 'Bình luận',
  user: 'Người dùng',
  problem: 'Bài tập lập trình',
  problem_bank: 'Ngân hàng bài tập',
  quiz: 'Quiz',
  roadmap: 'Lộ trình',
  role: 'Vai trò',
  analytics: 'Phân tích',
  audit: 'Nhật ký hệ thống',
  admin: 'Quản trị',
  system: 'Hệ thống'
};

// Splits a permission name into [resource, action]. Handles both ':' (e.g.
// post:edit_own) and '.' (e.g. system.full_control) separators.
export function splitPermission(name: string): { resource: string; action: string } {
  const sepIndex = Math.max(name.indexOf(':'), name.indexOf('.'));
  if (sepIndex < 0) {
    return { resource: name, action: name };
  }
  return {
    resource: name.slice(0, sepIndex),
    action: name.slice(sepIndex + 1)
  };
}

function moduleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

// Builds the matrix from the permission catalog. Only columns that have at least
// one real permission somewhere in the catalog are kept, preserving the fixed
// action order. Rows are ordered to match MODULE_LABELS, with any unknown module
// appended afterwards.
export function buildPermissionMatrix(catalog: PermissionModule[]): {
  columns: PermissionMatrixColumn[];
  rows: PermissionMatrixRow[];
} {
  const permissions = catalog.flatMap(m => m.permissions);

  // Index permissions by resource + action for O(1) cell lookup.
  const byResourceAction = new Map<string, PermissionItem>();
  const resourcesSeen = new Set<string>();
  const actionsSeen = new Set<string>();

  for (const perm of permissions) {
    const { resource, action } = splitPermission(perm.name);
    byResourceAction.set(`${resource}::${action}`, perm);
    resourcesSeen.add(resource);
    actionsSeen.add(action);
  }

  // Keep only columns that appear in the catalog, in the fixed order.
  const columns = ACTION_ORDER.filter(col => actionsSeen.has(col.action));

  // Order rows by MODULE_LABELS first, then any leftover resources alphabetically.
  const knownOrder = Object.keys(MODULE_LABELS);
  const orderedResources = [
    ...knownOrder.filter(r => resourcesSeen.has(r)),
    ...[...resourcesSeen].filter(r => !knownOrder.includes(r)).sort()
  ];

  const rows: PermissionMatrixRow[] = orderedResources.map(resource => ({
    module: resource,
    label: moduleLabel(resource),
    cells: columns.map(col => ({
      permission: byResourceAction.get(`${resource}::${col.action}`) ?? null
    }))
  }));

  return { columns, rows };
}
