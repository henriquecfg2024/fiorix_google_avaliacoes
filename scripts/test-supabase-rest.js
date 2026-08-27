const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          hasUrl: !!url,
          hasKey: !!key,
          message: 'SUPABASE_URL ou chave não encontrada no ambiente.',
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error, count } = await supabase
    .from('fiorix_bi_imports')
    .select('id,file_name,rows_count,imported_at,imported_by', { count: 'exact' })
    .order('imported_at', { ascending: false })
    .limit(3);

  console.log(
    JSON.stringify(
      {
        ok: !error,
        hasUrl: true,
        hasKey: true,
        count,
        sample: data || null,
        error: error
          ? {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            }
          : null,
      },
      null,
      2
    )
  );

  if (error) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        fatal: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
