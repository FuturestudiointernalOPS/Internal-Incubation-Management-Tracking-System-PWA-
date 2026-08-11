import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getSystemSettings, updateSetting, getFeatureFlags, updateFeatureFlag,
  getSystemRoles, updateRole, createRole, getSystemInfo, getAdminActivityLogs,
} from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
    const s = new URL(req.url).searchParams;
    const type = s.get("type") || "settings";

    if (type === "settings") {
      const settings = await getSystemSettings();
      return NextResponse.json({ success: true, settings });
    }

    if (type === "features") {
      const flags = await getFeatureFlags();
      return NextResponse.json({ success: true, features: flags });
    }

    if (type === "roles") {
      const roles = await getSystemRoles();
      return NextResponse.json({ success: true, roles });
    }

    if (type === "system") {
      const info = await getSystemInfo();
      return NextResponse.json({ success: true, ...info });
    }

    if (type === "logs") {
      const logs = await getAdminActivityLogs(parseInt(s.get("limit")) || 50);
      return NextResponse.json({ success: true, logs });
    }

    return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
  },
);

export const PATCH = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
    const body = await req.json();
    const { action } = body;

    if (action === "update_setting") {
      await updateSetting(body.setting_key, body.setting_value, req.session?.cid);
      return NextResponse.json({ success: true });
    }

    if (action === "update_feature") {
      await updateFeatureFlag(body.flag_key, body.is_enabled, req.session?.cid);
      return NextResponse.json({ success: true });
    }

    if (action === "update_role") {
      await updateRole(parseInt(body.role_id), { ...body.updates, _updated_by: req.session?.cid });
      return NextResponse.json({ success: true });
    }

    if (action === "create_role") {
      const result = await createRole({ name: body.name, description: body.description, permissions: body.permissions, createdBy: req.session?.cid });
      return NextResponse.json({ success: true, role_id: result.id });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  },
);
