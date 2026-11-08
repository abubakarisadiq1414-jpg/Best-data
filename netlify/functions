const crypto = require("crypto");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const headers = { "Content-Type": "application/json" };

  try {
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const supabaseUrl = "https://thpezxjjwzvejsslxzan.supabase.co";

    if (!paystackKey || !supabaseKey) {
      throw new Error("Payment service is not configured.");
    }

    const data = JSON.parse(event.body || "{}");
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const phone = String(data.phone || "").trim();
    const network = String(data.network || "");
    const gb = Number(data.gb);

    if (
      !name || !phone ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !["MTN", "Telecel", "AirtelTigo"].includes(network) ||
      !Number.isInteger(gb) || gb < 1 || gb > 20
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Please check your order details." })
      };
    }

    const amount = gb * 5.5;
    const orderId = "BD" + crypto.randomUUID().replace(/-/g, "");

    const dbHeaders = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": "Bearer " + supabaseKey,
      "Prefer": "return=minimal"
    };

    const orderResponse = await fetch(supabaseUrl + "/rest/v1/orders", {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({
        order_id: orderId,
        customer_name: name,
        phone: phone,
        network: network,
        bundle: gb + " GB",
        amount: amount,
        status: "Pending"
      })
    });

    if (!orderResponse.ok) {
      throw new Error("Could not save your order. Please try again.");
    }

    const paymentResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + paystackKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          amount: Math.round(amount * 100),
          currency: "GHS",
          channels: ["mobile_money"],
          callback_url: "https://fantastic-youtiao-85ad71.netlify.app",
          metadata: {
            order_id: orderId,
            customer_name: name,
            phone: phone,
            network: network,
            bundle: gb + " GB"
          }
        })
      }
    );

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok || !payment.status || !payment.data) {
      await fetch(
        supabaseUrl + "/rest/v1/orders?order_id=eq." + encodeURIComponent(orderId),
        {
          method: "PATCH",
          headers: dbHeaders,
          body: JSON.stringify({ status: "Cancelled" })
        }
      );
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: payment.message || "Could not start payment." })
      };
    }

    const updateResponse = await fetch(
      supabaseUrl + "/rest/v1/orders?order_id=eq." + encodeURIComponent(orderId),
      {
        method: "PATCH",
        headers: dbHeaders,
        body: JSON.stringify({ payment_reference: payment.data.reference })
      }
    );

    if (!updateResponse.ok) {
      throw new Error("Could not save the payment reference. Please contact support.");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        authorization_url: payment.data.authorization_url,
        reference: payment.data.reference
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Something went wrong." })
    };
  }
};
