import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/features/case/case.model";
import Leads from "@/features/leads/lead.model";
import Lender from "@/features/leander/leander.model";
import User from "@/features/users/user.model";
import { getAuthenticatedUser, requireRole } from "@/lib/auth";

const eligibilityFor = (lender: { eligibility?: { age: { min: number; max: number }; income: { minAnnual: number }; creditScore: { minExclusive: number; maxInclusive: number }; employmentTypes: string[] } } | null): Record<string, unknown> => {
  const eligibility = lender?.eligibility ?? {
    age: { min: 10, max: 100 },
    income: { minAnnual: 10000 },
    creditScore: { minExclusive: 300, maxInclusive: 850 },
    employmentTypes: ["salaried", "self_employed", "business", "professional"],
  };

  return {
    "personal.age": { $gte: eligibility.age.min, $lte: eligibility.age.max },
    "employment.income": { $gte: eligibility.income.minAnnual },
    "credit.creditScore": { $gt: eligibility.creditScore.minExclusive, $lte: eligibility.creditScore.maxInclusive },
    "employment.type": { $in: eligibility.employmentTypes },
  };
};
//can se all the lead that has been assigned to the agent and also can see all the lead that is free and eligible for the lender. The agent can assign the lead to himself. The admin can assign the lead to any agent of his lender. The agent can only see the leads that are assigned to him. The admin can see all the leads that are assigned to any agent of his lender.
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin", "lender_agent"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    if (!currentUser.lenderId) {
      return NextResponse.json({ success: false, message: "Lender is not configured" }, { status: 400 });
    }
    await connectDB();
    if (currentUser.role === "lender_agent") {
      const data = await Case.find({ agentId: currentUser._id }).populate("leadId").lean();
      return NextResponse.json({
        success: true,
        assignedLeads: data,
        count: data.length,
        totalCount: data.length,
        pagination: { page: 1, pageSize: data.length, totalPages: 1 },
      });
    }
    const lender = await Lender.findById(currentUser.lenderId).lean();
    const assignedLeadIds = await Case.find({
      lenderId: currentUser.lenderId,
    }).distinct("leadId");
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(request.nextUrl.searchParams.get("pageSize") || 10), 1), 100);
    const filter = {
      ...eligibilityFor(lender),
      _id: { $nin: assignedLeadIds },
    };
    const [totalCount, data] = await Promise.all([
      Leads.countDocuments(filter),
      Leads.find(filter).sort({ "metadata.createdAt": -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ]);

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      totalCount,
      pagination: { page, pageSize, totalPages: Math.ceil(totalCount / pageSize) },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to fetch free leads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    if (!currentUser.lenderId) {
      return NextResponse.json({ success: false, message: "Lender is not configured" }, { status: 400 });
    }

    const body = await request.json();
    const { leadId, agentId } = body as { leadId?: string; agentId?: string };
    if (!leadId || !agentId || !isValidObjectId(leadId) || !isValidObjectId(agentId)) {
      return NextResponse.json({ success: false, message: "Valid leadId and agentId are required" }, { status: 400 });
    }

    await connectDB();
    const lender = await Lender.findById(currentUser.lenderId).lean();
    if (!lender) return NextResponse.json({ success: false, message: "Lender not found" }, { status: 404 });
    const [agent, lead] = await Promise.all([
      User.findOne({ _id: agentId, lenderId: currentUser.lenderId, role: "lender_agent", status: "active" }).select("_id name email").lean(),
      Leads.findOne({ _id: leadId, ...eligibilityFor(lender) }).select("_id").lean(),
    ]);
    if (!agent) return NextResponse.json({ success: false, message: "Active agent not found for this lender" }, { status: 400 });
    if (!lead) return NextResponse.json({ success: false, message: "Lead is not eligible for this lender" }, { status: 400 });

    const existing = await Case.exists({ lenderId: currentUser.lenderId, leadId });
    if (existing) return NextResponse.json({ success: false, message: "Lead is already assigned" }, { status: 409 });
    console.log(currentUser._id);
    const assignment = await Case.create({
      leadId,
      lenderId: currentUser.lenderId,
      agentId,
      lenderAdminId: currentUser._id,
      status: "ASSIGNED",
      assignedAt: new Date(),
    });
    return NextResponse.json({ success: true, data: assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      return NextResponse.json({ success: false, message: "Lead is already assigned" }, { status: 409 });
    }
    console.error("Error assigning lead:", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Failed to assign lead" }, { status: 500 });
  }
}
