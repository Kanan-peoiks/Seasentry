# SeaSentry — layihə və dizayn qeydləri

Tarix: 14 oktyabr 2026. Mövcud mənbə kodunun oxunuşuna əsaslanır; brauzerdə vizual yoxlama və build/test icrası aparılmayıb.

## Məhsulun məqsədi

SeaSentry Xəzər dənizində mümkün neft sızmalarını aşkarlamaq, sübutları yoxlamaq və cavab tədbirlərini planlaşdırmaq üçün əməliyyat platformasıdır. Əsas axın: xəritədə məkan seçimi → peyk skanı və ya əl ilə bildiriş → analiz → mütəxəssisin qərarı → təmizləmə/həll → hesabat. Son qərar insana məxsusdur.

## Quruluş

- **Frontend:** Next.js 16.2.11 App Router, React 19.2.4, TypeScript. Dev/build `--webpack` istifadə edir.
- **Backend:** FastAPI, SQLAlchemy, Pydantic; PostgreSQL və ya lokal SQLite.
- **API axını:** brauzer → `app/api/*` → FastAPI. Server `seasentry_token` httpOnly cookie-sini Bearer başlığına çevirir.
- **İcazələr:** `viewer`, `operator`, `admin`. Demo hesabı viewer-dir; yaratma və qərar əməliyyatları operator/admin üçündür.
- **Məlumat vəziyyəti:** `lib/incident-store.tsx` hadisələri yükləyir və əlaqəli KPI, analiz və response məlumatlarını törədir. Yaratma/qərarlar backend-də saxlanılır. Avtomatik polling yoxdur.
- **Xəritə/qrafik/ixrac:** Leaflet + react-leaflet, Recharts, jsPDF.
- **Dil və görünüş:** EN/AZ, light/dark; CSS dəyişənləri və localStorage seçimləri. Vaxt təqdimatında Asia/Baku istifadə olunur, bəzi filtrlərdə uyğunsuzluq var.
- **Əsas ekranlar:** landing, auth, dashboard, incidents, AI analysis, vessels, response, reports, account və admin.

## Hansı məlumat realdır?

| Hissə | Kodda hazırkı vəziyyət |
| --- | --- |
| Hesablar, hadisələr, qərarlar, feedback, admin | Backend və verilənlər bazası ilə işləyir. |
| Sentinel-1 skanı | Copernicus-dən real SAR təsviri; lokal klassik kompüter görməsi detektoru. Təlim edilmiş ML modeli deyil. İstəyə bağlı xarici model ünvanı dəstəklənir. |
| SAR təsviri və overlay | Real skan nəticələri bunları saxlayıb hadisə panelində göstərə bilir; manual/seed hadisələrində olmaya bilər. |
| Hava/dəniz məlumatları | Open-Meteo. Ölçmənin vaxtı və məlumatın köhnəlməsi vacibdir. |
| Live AIS | Ayrı sorğu ilə aisstream snapshot-u; davamlı izləmə deyil. Əsas gəmi reyestri isə demo məlumatıdır. |
| Simulyasiya | `inc-live` yalnız client vəziyyətində yaşayır; bazaya yazılmır. |
| Risk zonaları, activity feed, resurslar, bəzi trendlər | `lib/mock-data.ts` üzərindən təqdimat məlumatıdır. |
| Drift, material və xərc hesabları | Sadələşdirilmiş fizika/formullar; müşahidə edilmiş nəticələr kimi təqdim edilməməlidir. |
| Şirkət aidiyyəti, bəzi AI alt göstəriciləri və mərhələlər | Deterministik/illüstrativ fallback-lar var. Real skan alt göstəriciləri mövcud olduqda istifadə olunur. |
| Hesabat arxivi | Hesabatın snapshot/məbləğ məlumatı saxlanılır; PDF faylının özü backend-də arxivlənmir. |

README-nin bəzi hissələri koddan geridədir: `/detect` artıq sadəcə stub deyil, real təsvirlər göstərilə bilir və on-demand AIS mövcuddur. Gələcək dəyişikliklərdə mənbə koduna üstünlük verilməlidir.

## Dizayn istiqaməti

Xəritə əsas situasiya görünüşü olmalıdır. Operator hadisənin məkanını, sübutunu, riskini və növbəti mümkün qərarını tez anlamalıdır. Landing səhifəsinin fərqləndirici elementi də Xəzər/SAR/əməliyyat axını olmalıdır.

Mövcud light/dark tokenləri, kompakt sıxlıq və IBM Plex Sans başlanğıc bazasıdır. Yeni rəng sistemi qurularkən real məlumat, təxmin, demo, risk və icazə vəziyyətlərinin mənası qorunmalıdır. Risk rəngləri təkbaşına məlumat daşımamalıdır; mətn və ikonla tamamlanmalıdır.

Hadisə panelində yuxarıda kimlik, status, mənbə/vaxt və qərar zonası; aşağıda SAR sübutu, ölçmələr və açılıb-bağlanan ikinci dərəcəli analizlər məqsədəuyğundur. Mobil görünüşdə cədvəllər hadisənin adı, risk, status və detallara keçidi saxlayan yığcam sətirlərə çevrilə bilər.

Animasiya istifadəçinin etdiyi dəyişikliyi izah etməlidir. Fokus, klaviatura idarəsi, reduced motion, yük­lənmə, xəta və boş nəticə vəziyyətləri ortaq komponentlərdə həll edilməlidir.

## Prioritet tapıntılar

- `components/incidents/IncidentDetailsPanel.tsx:1053` — əsas insan qərarı uzun panelin aşağı hissəsindədir; hadisə başlığında növbəti əməliyyatı görünən etmək.
- `components/incidents/IncidentDetailsPanel.tsx:1265` — “yenidən yarat” yazılan PDF düyməsi `ready` vəziyyətində disabled qalır. `app/reports/page.tsx:730` eyni davranışı təkrarlayır.
- `app/reports/page.tsx:388` — “Generate report” yalnız preview açır; ad və əməliyyat uyğunlaşdırılmalıdır.
- `components/Header.tsx:150` — “System Online” sistem sağlamlığına deyil, simulyasiya vəziyyətinə bağlıdır; simulyasiya və servis statusu ayrı göstərilməlidir.
- `components/SeaWeatherWidget.tsx:100` — çatışmayan ölçmələr sıfıra çevrilir; “məlumat yoxdur” sakit hava ilə qarışmamalıdır.
- `lib/incident-store.tsx:224` — bir dəfə yüklənmə, retry/revalidation yoxdur. Xəta istifadəçiyə boş reyestr kimi görünə bilər.
- `lib/auth.ts:231` — backend 502 kimi servis xətası sessiyanı silə bilir; sessiya bitməsi və xidmətin əlçatmazlığı ayrılmalıdır.
- `components/ui/DetailPanel.tsx:134` — dialog-da fokus idarəsi, Escape və fokusun saxlanması yoxdur.
- `components/ui/FilterBar.tsx:64` — axtarış sahəsinin ayrıca label/aria-label-i yoxdur. `app/ai-analysis/page.tsx:199` və `components/ActivityFeed.tsx:78` klaviatura ilə idarə edilməyən klik elementləridir.
- `app/incidents/page.tsx:260`, `app/vessels/page.tsx:164` — geniş div əsaslı reyestrlər mobil üçün çox üfüqi sürüşmə tələb edir; semantik desktop table və mobil sətirlər uyğun olar.
- `components/ui/StatCard.tsx:49`, `components/KpiCards.tsx:118` — CSS dəyişəninə `18` artırılması etibarsız rəng yaradır; ayrıca soft token və ya `color-mix` istifadə edilməlidir.
- `components/landing/LandingPage.tsx:132` — addım div-lərində `landing-step` sinfi yoxdur; `app/globals.css:768` və `:774` stilləri tətbiq edilmir.
- `app/globals.css:325` — sabit `100vh` shell; mobil dinamik viewport yoxlanmalıdır. Qlobal reduced-motion və focus-visible qaydaları yoxdur; mobil landing naviqasiyası yığılmır.
- `app/layout.tsx:33` — AZ seçiləndə də HTML `lang="en"` qalır. Tarix/rəqəm və ixrac dilinin vahid qaydası lazımdır.
- `backend/app/routers/incidents.py:54` — həll edilmiş hadisə əvvəlki təsdiq qərarını əvəz etdiyi üçün AI accuracy hesabından çıxır. KPI dizaynından əvvəl tərif düzəldilməlidir.
- `backend/app/routers/detect.py:139` — lokal detektorun minimum blob sahəsi HIGH risk həddindən böyükdür; qəbul edilən lokal nəticələrin hamısı HIGH olur. Risk vizualları bu məhdudiyyəti gizlətməməlidir.

## Quraşdırılmış skill-lər

- `C:\Users\bizne\.codex\skills\frontend-design\SKILL.md` — vizual istiqamət, tipoqrafiya, kompozisiya və məhsula uyğun üslub. Mənbə: [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design).
- `C:\Users\bizne\.codex\skills\web-design-guidelines\SKILL.md` — UX, formalar, fokus, əlçatanlıq və responsive kod yoxlaması. Mənbə: [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines); [yoxlama qaydaları](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

Hər ikisi rəsmi `skill-installer` helper-i ilə quraşdırılıb və SKILL.md faylları oxunub. Skill-lər növbəti mesajda avtomatik istifadəyə açılacaq; qaydaları bu oxunuşda da nəzərə alınıb.

## Oxunuş və yoxlama sərhədi

`app/`, `components/`, `lib/`, `backend/` altındakı bütün birinci tərəf mənbə faylları, testlər, konfiqurasiya və layihə sənədləri oxunub. Aktiv dashboard xəritə/weather/KPI/recent incidents/activity komponentlərindən istifadə edir; köhnə WidgetGrid və ona bağlı widget dəsti hazırkı ekranlardan çağırılmır.

Bu işdə tətbiqin mənbə kodu dəyişdirilməyib. Quraşdırma xaricində əlavə olunan yeganə layihə faylı bu qeyddir. Lokal `node_modules` mövcud deyil; gələcək Next.js kod dəyişikliklərindən əvvəl asılılıqlar qurulmalı və AGENTS.md tələbinə uyğun `node_modules/next/dist/docs/` daxilində aidiyyəti təlimat oxunmalıdır.
