import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import CaseNode from "@/features/case/caseNode.model";
import Case from "@/features/case/case.model";
import { CaseEvent } from "@/features/case/caseEvent.model";
import { getAuthenticatedUser, requireRole } from "@/lib/auth";

import mongoose from "mongoose";
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_agent"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const caseId = request.nextUrl.searchParams.get("caseId");
    if (caseId && !isValidObjectId(caseId)) {
      return NextResponse.json({ success: false, message: "Invalid caseId" }, { status: 400 });
    }
    await connectDB();
    const cases = await Case.find({
      agentId: currentUser._id,
      ...(caseId ? { _id: caseId } : {}),
    }).select("_id leadId lenderId agentId status currentNodeId").lean();
    if (caseId && cases.length === 0) {
      return NextResponse.json({ success: false, message: "Case not found" }, { status: 404 });
    }
    const data = await CaseNode.find({
      agentId: currentUser._id,
      ...(caseId ? { caseId } : {}),
    }).sort({ createdAt: 1 }).lean();
    return NextResponse.json({
      success: true,
      data,
      cases,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to get case nodes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_agent"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as {
      action?: "create" | "answer";
      caseId?: string;
      nodeId?: string;
      parentId?: string | null;
      type?: "QUESTION" | "OUTCOME";
      question?: { text?: string; answerType?: string; options?: { value: string; label: string }[] };
      answer?: { value?: unknown; label?: string | null };
      outcome?: { code?: string; label?: string };
      status?: "COMPLETED" | "REJECTED" | "CANCELLED";
    } | null;
    if (!body) {
      return NextResponse.json({ success: false, message: "Request body must be valid JSON" }, { status: 400 });
    }
    const action = body.action ?? "create";
    if (!body.caseId || !isValidObjectId(body.caseId)) {
      return NextResponse.json({ success: false, message: "Valid caseId is required" }, { status: 400 });
    }
    if (action !== "create" && action !== "answer") {
      return NextResponse.json({ success: false, message: "action must be create or answer" }, { status: 400 });
    }
    if (action === "answer" && (!body.nodeId || !isValidObjectId(body.nodeId))) {
      return NextResponse.json({ success: false, message: "Valid nodeId is required" }, { status: 400 });
    }
    if (action === "answer" && (body.answer?.value === undefined || body.answer?.value === null)) {
      return NextResponse.json({ success: false, message: "Answer value is required" }, { status: 400 });
    }
    if (action === "create" && body.parentId && !isValidObjectId(body.parentId)) {
      return NextResponse.json({ success: false, message: "Invalid parentId" }, { status: 400 });
    }
    if (action === "create" && body.type !== "QUESTION" && body.type !== "OUTCOME") {
      return NextResponse.json({ success: false, message: "type must be QUESTION or OUTCOME" }, { status: 400 });
    }
    if (action === "create" && body.type === "QUESTION" && (!body.question?.text?.trim() || !body.question.answerType)) {
      return NextResponse.json({ success: false, message: "Question text and answerType are required" }, { status: 400 });
    }
    const answerTypes = ["TEXT", "NUMBER", "BOOLEAN", "SINGLE_SELECT", "MULTI_SELECT"];
    if (action === "create" && body.type === "QUESTION" && !answerTypes.includes(body.question?.answerType ?? "")) {
      return NextResponse.json({ success: false, message: "Invalid question answerType" }, { status: 400 });
    }
    if (action === "create" && body.type === "OUTCOME" && (!body.outcome?.code?.trim() || !body.outcome.label?.trim())) {
      return NextResponse.json({ success: false, message: "Outcome code and label are required" }, { status: 400 });
    }

    await connectDB();
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const caseRecord = await Case.findOne(
          { _id: body.caseId, agentId: currentUser._id },
          null,
          { session },
        );
        if (!caseRecord) {
          throw new Error("Case not found or not assigned to this agent");
        }
        if (["COMPLETED", "REJECTED", "CANCELLED"].includes(caseRecord.status)) {
          throw new Error("This case is already closed");
        }

        if (action === "answer") {
          const answer = body.answer;
          if (!answer) {
            throw new Error("Answer value is required");
          }
          const node = await CaseNode.findOne(
            { _id: body.nodeId, caseId: caseRecord._id, agentId: currentUser._id },
            null,
            { session },
          );
          if (!node || node.type !== "QUESTION") {
            throw new Error("Question node not found");
          }
          node.answer = { value: answer.value, label: answer.label ?? null };
          await node.save({ session });
          await CaseEvent.create([{
            caseId: caseRecord._id,
            agentId: currentUser._id,
            actorType: "AGENT",
            type: "ANSWER_SUBMITTED",
            nodeId: node._id,
          }], { session });
          return { data: node, caseRecord };
        }

        if (body.parentId) {
          const parent = await CaseNode.exists({
            _id: body.parentId,
            caseId: caseRecord._id,
            agentId: currentUser._id,
          }).session(session);
          if (!parent) {
            throw new Error("Parent node not found");
          }
        }

        const [node] = await CaseNode.create([{
          caseId: caseRecord._id,
          lenderId: caseRecord.lenderId,
          agentId: currentUser._id,
          parentId: body.parentId || null,
          type: body.type,
          question: body.type === "QUESTION" ? body.question : undefined,
          outcome: body.type === "OUTCOME" ? body.outcome : undefined,
        }], { session });

        const wasAssigned = caseRecord.status === "ASSIGNED";
        caseRecord.currentNodeId = node._id;
        if (wasAssigned) {
          caseRecord.status = "IN_PROGRESS";
          caseRecord.startedAt = new Date();
        }
        if (body.type === "OUTCOME") {
          caseRecord.status = body.status ?? "COMPLETED";
          caseRecord.finalOutcome = body.outcome;
          caseRecord.completedAt = new Date();
        }
        await caseRecord.save({ session });
        await CaseEvent.create([{
          caseId: caseRecord._id,
          agentId: currentUser._id,
          actorType: "AGENT",
          type: body.type === "OUTCOME" ? "OUTCOME_CREATED" : "NODE_CREATED",
          nodeId: node._id,
        }], { session });
        if (body.type === "OUTCOME") {
          await CaseEvent.create([{
            caseId: caseRecord._id,
            agentId: currentUser._id,
            actorType: "AGENT",
            type: "CASE_COMPLETED",
            nodeId: node._id,
          }], { session });
        } else if (wasAssigned) {
          await CaseEvent.create([{
            caseId: caseRecord._id,
            agentId: currentUser._id,
            actorType: "AGENT",
            type: "CASE_STARTED",
            nodeId: node._id,
          }], { session });
        }

        return {
          data: node,
          caseRecord,
        };
      });
      return NextResponse.json({ success: true, data: result.data, case: result.caseRecord }, { status: action === "answer" ? 200 : 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process case node";
      const status = message.includes("not found") ? 404 : message.includes("already closed") ? 409 : 500;
      return NextResponse.json({ success: false, message }, { status });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to process case node" }, { status: 500 });
  }
}
