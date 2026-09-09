// Supabase Edge Function: extract-document
// Deploy: supabase functions deploy extract-document
// This is a scaffold — plug in your preferred OCR API (Google Document AI, OpenAI Vision, etc.)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { filePath } = await req.json() as { filePath: string };

    if (!filePath) {
      return new Response(JSON.stringify({ error: 'filePath is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('purchase-docs')
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // ─────────────────────────────────────────────────────────────────
    // TODO: Replace this mock with a real OCR API call.
    //
    // Option A — OpenAI Vision:
    //   const base64 = btoa(String.fromCharCode(...new Uint8Array(await fileData.arrayBuffer())));
    //   const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //     method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: [
    //       { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
    //       { type: 'text', text: 'Extract: seller name, item name, base price, GST, total, invoice date, order number. Return JSON.' }
    //     ]}]})
    //   });
    //   const json = await response.json();
    //   const extracted = JSON.parse(json.choices[0].message.content);
    //
    // Option B — Google Document AI (see their REST API docs)
    // ─────────────────────────────────────────────────────────────────

    // Mock response for development (delete after connecting real OCR)
    const extracted = {
      seller_name: null,
      item_name: null,
      base_price: null,
      gst_amount: null,
      shipping_cost: null,
      total_amount: null,
      invoice_date: null,
      order_number: null,
      _mock: true,
      _message: 'Connect a real OCR API in supabase/functions/extract-document/index.ts',
    };

    return new Response(JSON.stringify({ data: extracted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
