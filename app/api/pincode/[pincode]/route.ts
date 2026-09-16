import { NextResponse } from "next/server";

type PostalOffice = {
  District?: string;
  Block?: string;
  State?: string;
  Pincode?: string;
};

type PostalApiResponse = {
  Status?: string;
  PostOffice?: PostalOffice[] | null;
};

type RouteContext = {
  params: Promise<{ pincode: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { pincode } = await context.params;

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { success: false, message: "Pincode must contain exactly 6 digits." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`,
      { next: { revalidate: 86400 } },
    );

    if (!response.ok) {
      throw new Error(`Postal lookup failed with status ${response.status}`);
    }

    const result = (await response.json()) as PostalApiResponse[];
    const postOffice = result[0]?.PostOffice?.[0];
    const city = postOffice?.District || postOffice?.Block;

    if (result[0]?.Status !== "Success" || !city) {
      return NextResponse.json(
        { success: false, message: "No location found for this pincode." },
        { status: 404 },
      );
    }
    console.log(postOffice.State?.trim());
    console.log(city);

    return NextResponse.json({
      success: true,
      data: {
        city: city.trim(),
        state: postOffice.State?.trim() || "",
        pincode: postOffice.Pincode || pincode,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error
          ? error.message
          : "Unable to look up this pincode.",
      },
      { status: 502 },
    );
  }
}
