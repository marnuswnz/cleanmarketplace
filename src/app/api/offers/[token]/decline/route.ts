import { handleOfferResponse } from "../respond";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handleOfferResponse(req, (await params).token, "decline");
}
