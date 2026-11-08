exports.handler = async function (event) {
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const supabaseUrl = "https://thpezxjjwzvejsslxzan.supabase.co";

    if (!paystackKey || !supabaseKey) {
      throw new Error("Payment service is not configured.");
    }

    const body = JSON.parse(event.body || "{}");
    const reference = String(body.reference || "").trim();

    if (!reference || !/^[a-zA-Z0-9_-]{1,100}$/.test(reference)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid payment reference." })
      };
    }

    const dbHeaders = {
      "apikey": supabaseKey,
      "Authorization": "Bearer " + supabaseKey,
      "Content-Type": "application/json"
    };

    const orderResponse = await fetch(
      supabaseUrl + "/rest/v1/orders?payment_reference=eq." +
      encodeURIComponent(reference) + "&select=order_id,amount,status",
      { headers: dbHeaders }
    );

    if (!orderResponse.ok) {
      throw new Error("Could not check the order.");
    }

    const orders = await orderResponse.json();
    if (!orders.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Order not found." })
      };
    }

    const order = orders[0];

    const paymentResponse = await fetch(
      "https://api.paystack.co/transaction/verify/" +
      encodeURIComponent(reference),
      { headers: { "Authorization": "Bearer " + paystackKey } }
    );

    const result = await paymentResponse.json();

    if (!paymentResponse.ok || !result.status || !result.data) {
      throw new Error("Could not verify payment with Paystack.");
    }

    const payment = result.data;
    const expectedAmount = Math.round(Number(order.amount) * 100);

    if (
      payment.status !== "success" ||
      payment.currency !== "GHS" ||
      payment.amount !== expectedAmount
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          paid: false,
          message: "Payment has not been confirmed."
        })
      };
    }

    if (order.status === "Cancelled") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ paid: false, error: "This order was cancelled." })
      };
    }

    const updateResponse = await fetch(
      supabaseUrl + "/rest/v1/orders?order_id=eq." +
      encodeURIComponent(order.order_id),
      {
        method: "PATCH",
        headers: {
          ...dbHeaders,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ status: "Paid" })
      }
    );

    if (!updateResponse.ok) {
      throw new Error("Payment was verified, but the order update failed.");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paid: true,
        order_id: order.order_id,
        message: "Payment verified successfully."
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Verification failed." })
    };
  }
};
