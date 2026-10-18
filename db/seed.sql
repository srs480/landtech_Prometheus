-- ===== DUMMY DATA ONLY. No real people, NIDs, or records. =====

-- ===== SECTION: Geography =====
INSERT INTO divisions (id, name_bn) VALUES (1,'ঢাকা'),(2,'চট্টগ্রাম'),(3,'খুলনা'),(4,'রাজশাহী');
INSERT INTO districts (id, division_id, name_bn) VALUES
 (1,1,'ঢাকা'),(2,1,'গাজীপুর'),(3,2,'চট্টগ্রাম'),(4,2,'কক্সবাজার'),
 (5,3,'খুলনা'),(6,3,'যশোর'),(7,4,'রাজশাহী'),(8,4,'বগুড়া');
INSERT INTO upazilas (id, district_id, name_bn) VALUES
 (1,1,'সাভার'),(2,2,'গাজীপুর সদর'),(3,3,'পটিয়া'),(4,4,'কক্সবাজার সদর'),
 (5,5,'ডুমুরিয়া'),(6,6,'অভয়নগর'),(7,7,'পবা'),(8,8,'শিবগঞ্জ');
INSERT INTO mouzas (id, upazila_id, name_bn, jl_no) VALUES
 (1,1,'আশুলিয়া',12),(2,1,'ভাকুর্তা',15),(3,2,'কাশিমপুর',8),(4,3,'ধলঘাট',21),
 (5,4,'ঝিলংজা',5),(6,5,'ডুমুরিয়া',9),(7,6,'নওয়াপাড়া',14),(8,7,'হড়গ্রাম',3),(9,8,'মহাস্থান',17);

-- ===== SECTION: People (10 dummy) =====
INSERT INTO people (id, name_bn, father_name_bn, nid, phone, address_bn) VALUES
 (1,'কুদ্দুস মিয়া','আব্দুল মিয়া','1990000000001','01700000001','আশুলিয়া, সাভার'),
 (2,'আবির হাসান','কুদ্দুস মিয়া','1995000000002','01700000002','আশুলিয়া, সাভার'),
 (3,'বকুল আক্তার','কুদ্দুস মিয়া','1997000000003','01700000003','ভাকুর্তা, সাভার'),
 (4,'রহিম উদ্দিন','জমির উদ্দিন','1980000000004','01700000004','কাশিমপুর, গাজীপুর'),
 (5,'সালমা খাতুন','আবুল কাশেম','1985000000005','01700000005','ধলঘাট, পটিয়া'),
 (6,'করিম শেখ','রহমত শেখ','1975000000006','01700000006','ঝিলংজা, কক্সবাজার'),
 (7,'নাসিমা বেগম','আব্দুর রশিদ','1982000000007','01700000007','ডুমুরিয়া, খুলনা'),
 (8,'জাহিদ হোসেন','মজিবর রহমান','1988000000008','01700000008','নওয়াপাড়া, যশোর'),
 (9,'ফারহানা ইয়াসমিন','আনোয়ার হোসেন','1992000000009','01700000009','হড়গ্রাম, রাজশাহী'),
 (10,'মিজানুর রহমান','আফতাব আলী','1978000000010','01700000010','মহাস্থান, বগুড়া');

-- ===== SECTION: Users (demo password for ALL: Demo@1234; bcrypt via pgcrypto) =====
INSERT INTO users (id, username, password_hash, role, full_name, designation, office_name, office_code, district_id, upazila_id, person_id) VALUES
 (1,'registrar_demo', crypt('Demo@1234', gen_salt('bf',10)),'registry','মোঃ শহিদুল ইসলাম','সাব-রেজিস্ট্রার','সাভার সাব-রেজিস্ট্রি অফিস','SR-1001',1,1,NULL),
 (2,'bank_demo',      crypt('Demo@1234', gen_salt('bf',10)),'bank','তানভীর আহমেদ','শাখা ব্যবস্থাপক','ডেমো ব্যাংক লি., সাভার শাখা','BNK-2001',1,1,NULL),
 (3,'dc_demo',        crypt('Demo@1234', gen_salt('bf',10)),'dc','নুসরাত জাহান','অতিরিক্ত জেলা প্রশাসক (রাজস্ব)','জেলা প্রশাসকের কার্যালয়, ঢাকা','DC-3001',1,NULL,NULL),
 (4,'lawyer_demo',    crypt('Demo@1234', gen_salt('bf',10)),'court','অ্যাডভোকেট সাব্বির রহমান','আইনজীবী','ঢাকা জেলা জজ আদালত','CT-4001',1,NULL,NULL),
 (5,'citizen_demo',   crypt('Demo@1234', gen_salt('bf',10)),'citizen','ফারহানা ইয়াসমিন','ক্রেতা/নাগরিক','—','CZ-5001',7,7,9);

-- ===== SECTION: Plots, khatians, owners =====
INSERT INTO plots (id, mouza_id, dag_no, area_decimal, land_type, is_khas, is_acquired) VALUES
 (1,1,'101',33,'বসতভিটা',false,false),
 (2,1,'102',50,'কৃষি',false,false),   -- active mortgage
 (3,1,'205',75,'কৃষি',false,false),   -- court injunction
 (4,2,'310',120,'কৃষি',true,false),   -- khas
 (5,2,'311',90,'বাণিজ্যিক',false,true), -- acquired
 (6,3,'410',40,'বসতভিটা',false,false), -- pending mutation
 (7,3,'411',60,'কৃষি',false,false),   -- joint owners
 (8,4,'520',25,'ডোবা',false,false),
 (9,5,'601',45,'বসতভিটা',false,false),
 (10,6,'705',80,'কৃষি',false,false);
INSERT INTO khatians (mouza_id, khatian_type, khatian_no, plot_id) VALUES
 (1,'RS','112',1),(1,'RS','113',2),(1,'CS','45',3),(2,'SA','77',4),(2,'SA','78',5),
 (3,'BRS','201',6),(3,'BRS','202',7),(4,'CS','12',8),(5,'RS','300',9),(6,'SA','90',10);
INSERT INTO plot_owners (plot_id, person_id, share_pct, is_current, since) VALUES
 (1,1,100,true,'2018-04-10'),(2,2,100,true,'2015-01-20'),(3,3,100,true,'2012-07-05'),
 (5,4,100,true,'2010-03-15'),(6,5,100,true,'2016-09-01'),(7,6,50,true,'2014-02-02'),(7,7,50,true,'2014-02-02'),
 (8,8,100,true,'2019-11-11'),(9,9,100,true,'2017-06-06'),(10,10,100,true,'2013-12-12');

-- ===== SECTION: Deeds, mutations, mortgage, case =====
INSERT INTO deeds (id, deed_no, deed_type, plot_id, seller_id, buyer_id, price, registered_by, registered_on) VALUES
 (1,'D-2018-0001','সাফ কবলা',1,6,1,1500000,1,'2018-04-05'),
 (2,'D-2026-0002','সাফ কবলা',6,5,2,900000,1,'2026-09-28'),
 (3,'D-2026-0003','বায়নানামা',8,8,2,300000,1,'2026-08-15');
INSERT INTO mutations (id, mutation_no, plot_id, deed_id, from_person_id, to_person_id, status, created_on, completed_on) VALUES
 (1,'M-2018-0001',1,1,6,1,'completed','2018-04-10','2018-04-10'),
 (2,'M-2026-0002',6,2,5,2,'pending','2026-09-28',NULL);
INSERT INTO mortgages (plot_id, bank_user_id, borrower_id, amount, loan_account, loan_date, status, remarks) VALUES
 (2,2,2,800000,'LN-DEMO-0001','2025-03-10','active','ব্যবসায়িক ঋণ');
INSERT INTO court_cases (plot_id, court, case_no, case_type, status, injunction, filed_on) VALUES
 (3,'ঢাকা জেলা জজ আদালত','দেওয়ানী মামলা ১২৩/২০২৫','স্বত্ব মামলা','pending',true,'2025-06-01');

-- ===== SECTION: Timeline (hash chain is built by the DB trigger) =====
INSERT INTO land_events (plot_id, event_type, title, details, actor, occurred_on) VALUES
 (1,'sale','করিম শেখ থেকে কুদ্দুস মিয়ার নামে বিক্রয়','সাফ কবলা D-2018-0001, মূল্য ১৫,০০,০০০ টাকা','সাব-রেজিস্ট্রার','2018-04-05'),
 (1,'mutation','নামজারি সম্পন্ন','নামজারি M-2018-0001','সহকারী কমিশনার (ভূমি)','2018-04-10'),
 (2,'mortgage','ব্যাংক বন্ধক','ডেমো ব্যাংক, ঋণ হিসাব LN-DEMO-0001, ৮,০০,০০০ টাকা','ডেমো ব্যাংক','2025-03-10'),
 (3,'case','মামলা দায়ের ও নিষেধাজ্ঞা','ঢাকা জেলা জজ আদালত, দেওয়ানী মামলা ১২৩/২০২৫','আদালত','2025-06-01'),
 (4,'ownership','খাস জমি হিসেবে সরকারি তালিকাভুক্ত','এস.এ. রেকর্ড অনুযায়ী খাস','ভূমি অফিস','1998-01-01'),
 (5,'acquisition','অধিগ্রহণ নোটিশ জারি','সরকারি প্রকল্পের জন্য অধিগ্রহণ','জেলা প্রশাসক','2024-02-20'),
 (6,'sale','সালমা খাতুন থেকে আবির হাসানের নামে বিক্রয়','সাফ কবলা D-2026-0002 — নামজারি অপেক্ষমান','সাব-রেজিস্ট্রার','2026-09-28'),
 (8,'agreement','বায়নানামা সম্পাদিত','অগ্রিম ৩,০০,০০০ টাকা','সাব-রেজিস্ট্রার','2026-08-15');

-- keep serial counters ahead of explicit ids
SELECT setval(pg_get_serial_sequence('deeds','id'), 3);
SELECT setval(pg_get_serial_sequence('mutations','id'), 2);

-- ===== SECTION: Demo access tokens (stored as SHA-256 of UPPERCASE token) =====
INSERT INTO access_tokens (token_hash, expires_at, max_uses, issued_to) VALUES
 (encode(digest('LAND-DEMO-1111','sha256'),'hex'), now() + interval '30 days', 20, 'ডেমো ক্রেতা ১'),
 (encode(digest('LAND-DEMO-2222','sha256'),'hex'), now() + interval '30 days', 20, 'ডেমো ক্রেতা ২'),
 (encode(digest('LAND-DEMO-9999','sha256'),'hex'), now() - interval '1 day', 20, 'মেয়াদোত্তীর্ণ ডেমো টোকেন');
