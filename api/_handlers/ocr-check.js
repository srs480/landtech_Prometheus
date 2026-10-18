// ===== SECTION: POST /api/ocr-check (STUB) =====
// TODO: plug Python OCR service here. Receive the multipart images (document type + files), forward them to the
// OCR service and return real extracted fields. Uploaded files must NOT be stored permanently.
import { route, ok, fail, clientIp } from '../_lib/http.js';
import * as Q from '../_lib/queries.js';

export default route({ methods: ['POST'] }, async (req, res) => {
  if (await Q.hitRate('ocr:' + clientIp(req), 30, 10)) return fail(res, 429, 'অনেকবার অনুরোধ করা হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন');
  req.resume?.();   // the stub never reads or keeps the uploaded bytes
  ok(res, {
    stub: true,
    message: 'এটি একটি ডেমো ফলাফল। বাংলা ওসিআর সংযুক্ত হলে এখানে যাচাইয়ের প্রকৃত ফলাফল দেখানো হবে।',
    result: { status: 'pending_ocr', fields: [] },
  });
});
