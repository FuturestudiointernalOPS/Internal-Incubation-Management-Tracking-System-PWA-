import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import db from "@/lib/db";
import {
  getFounderById,
  updateFounderRole,
  removeFounder,
  canManageFounders,
  logVentureActivity,
  createVentureNotification,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/founders/[founderId]
 *
 * Get a single founder by ID.
 */
export const GET = createHandler(
  async (req, { params }) => {
    const { id, founderId } = await params;

    const founder = await getFounderById(parseInt(founderId));
    if (!founder || founder.venture_id !== id) {
      return NextResponse.json({ success: false, error: "Founder not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, founder });
  },
);

/**
 * PATCH /api/ventures/[id]/founders/[founderId]
 *
 * Update a founder's role and details.
 */
export const PATCH = createHandler(
  async (req, { params }) => {
    const { id, founderId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const permission = await canManageFounders(id, session);
    if (!permission.allowed) {
      return NextResponse.json({ success: false, error: "Unauthorized to manage founders." }, { status: 403 });
    }

    const founder = await getFounderById(parseInt(founderId));
    if (!founder || founder.venture_id !== id) {
      return NextResponse.json({ success: false, error: "Founder not found." }, { status: 404 });
    }

    const body = await req.json();
    const { role, title, phone, name } = body;

    const result = await updateFounderRole({
      founderId: parseInt(founderId),
      role,
      title,
      phone,
      name: name !== undefined ? name : undefined,
    });

    // Log activity if role changed
    if (role && role !== founder.role) {
      await logVentureActivity({
        venture_id: id,
        action: "ROLE_UPDATED",
        actor_cid: session.cid || "system",
        actor_name: session.name || "System",
        details: {
          founder_id: parseInt(founderId),
          previous_role: founder.role,
          new_role: role,
        },
      });
    }

    const updated = await getFounderById(parseInt(founderId));

    return NextResponse.json({ success: true, founder: updated });
  },
);

/**
 * DELETE /api/ventures/[id]/founders/[founderId]
 *
 * Remove a founder from the venture.
 */
export const DELETE = createHandler(
  async (req, { params }) => {
    const { id, founderId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const permission = await canManageFounders(id, session);
    if (!permission.allowed) {
      return NextResponse.json({ success: false, error: "Unauthorized to manage founders." }, { status: 403 });
    }

    try {
      const result = await removeFounder({
        founderId: parseInt(founderId),
        ventureId: id,
        removedByFounderId: permission.founderId,
      });

      return NextResponse.json({ success: true, ...result });
    } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  },
);
