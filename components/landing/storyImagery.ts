/**
 * Slick outlines traced by hand on the real TerraSAR-X image of the 2009
 * Montara spill (`public/story/montara-sar.webp`, rotated to landscape,
 * pixel space 1557 × 1067). Used by the landing story and the capabilities
 * section so both draw the same detection over the same image.
 */
export const SAR_W = 1557;
export const SAR_H = 1067;
export const SPILL_1 = "515,162 505,107 500,62 540,42 640,47 720,82 790,117 840,167 880,207 925,267 960,307 1010,327 1050,367 1090,407 1140,457 1200,477 1260,507 1300,567 1290,627 1300,687 1360,737 1380,777 1330,807 1290,837 1180,852 1150,827 1120,767 1060,717 990,687 900,667 830,677 790,637 770,567 770,487 740,427 720,367 680,317 640,277 590,247 550,207";
export const SPILL_2 = "320,777 315,687 345,642 420,627 520,642 600,667 670,697 720,737 745,807 730,887 690,892 655,827 590,777 520,757 450,797 380,787";
export const toPath = (points: string) => `M${points.split(" ").join("L")}Z`;
