import type { CmsAdminRole } from "@/models/CmsAdmin";

export function canManageAdmins(role: CmsAdminRole): boolean {
  return role === "admin";
}

export function canManageSponsors(role: CmsAdminRole): boolean {
  return role === "admin";
}

export function canEditCampaigns(role: CmsAdminRole): boolean {
  return role === "admin";
}

export function canApproveFinance(role: CmsAdminRole): boolean {
  return role === "admin";
}

export function getCmsRoleLabel(role: CmsAdminRole): string {
  return role === "reviewer" ? "ตรวจสอบ" : "แอดมิน";
}
