export interface KeySpec {
  id: string;
  ariaLabel: string;
  primary: string;
  shiftLabel?: string;
  alphaLabel?: string;
  baseNLabel?: string;
  cmplxLeftLabel?: string;
  cmplxRightLabel?: string;
  modeTag?: boolean;
  col?: number;
  variant: 'sci' | 'num' | 'op' | 'accent';
}

export const SCIENTIFIC_ROW_1: readonly KeySpec[] = [
  {
    id: 'calc',
    ariaLabel: 'CALC تعويض المتغيرات أو SOLVE حل المعادلة أو علامة يساوي =',
    primary: 'CALC',
    shiftLabel: 'SOLVE',
    alphaLabel: '=',
    col: 1,
    variant: 'sci',
  },
  {
    id: 'integ',
    ariaLabel: 'تكامل محدد ∫dx أو تفاضل d/dx أو نقطتان :',
    primary: '∫dx',
    shiftLabel: 'd/dx',
    alphaLabel: ':',
    col: 2,
    variant: 'sci',
  },
  {
    id: 'inverse',
    ariaLabel: 'x⁻¹ مقلوب أو مضروب x!',
    primary: 'x⁻¹',
    shiftLabel: 'x!',
    col: 5,
    variant: 'sci',
  },
  {
    id: 'logbase',
    ariaLabel: 'log_a b لوغاريتم لأساس عام أو مجموع ∑ أو ضرب متسلسل ∏',
    primary: 'log■□',
    shiftLabel: '∑(',
    alphaLabel: '∏(',
    col: 6,
    variant: 'sci',
  },
];

export const SCIENTIFIC_ROWS_2_TO_4: readonly (readonly KeySpec[])[] = [
  [
    {
      id: 'frac',
      ariaLabel: 'كسر اعتيادي أو عدد كسري أو قسمة مع الباقي ÷R',
      primary: '■/□',
      shiftLabel: '■ □/□',
      alphaLabel: '÷R',
      variant: 'sci',
    },
    {
      id: 'sqrt',
      ariaLabel: 'جذر تربيعي أو جذر تكعيبي أو عدد عشري دوري',
      primary: '√■',
      shiftLabel: '³√■',
      alphaLabel: '■̅',
      variant: 'sci',
    },
    {
      id: 'square',
      ariaLabel: 'x² تربيع أو x³ تكعيب أو النظام العشري DEC',
      primary: 'x²',
      shiftLabel: 'x³',
      baseNLabel: 'DEC',
      variant: 'sci',
    },
    {
      id: 'power',
      ariaLabel: 'أس عام أو جذر نوني أو النظام الست عشري HEX',
      primary: 'x■',
      shiftLabel: 'ⁿ√■',
      baseNLabel: 'HEX',
      variant: 'sci',
    },
    {
      id: 'log',
      ariaLabel: 'log لوغاريتم عشري أو 10^x أو النظام الثنائي BIN',
      primary: 'log',
      shiftLabel: '10■',
      baseNLabel: 'BIN',
      variant: 'sci',
    },
    {
      id: 'ln',
      ariaLabel: 'ln لوغاريتم طبيعي أو e^x أو النظام الثماني OCT',
      primary: 'ln',
      shiftLabel: 'e■',
      baseNLabel: 'OCT',
      variant: 'sci',
    },
  ],
  [
    {
      id: 'neg',
      ariaLabel: 'إشارة سالبة (−) أو زاوية قطبية ∠ أو المتغير A',
      primary: '(−)',
      cmplxLeftLabel: '∠',
      alphaLabel: 'A',
      variant: 'sci',
    },
    {
      id: 'dms',
      ariaLabel: 'درجات ودقائق وثواني أو تحليل لعوامل أولية FACT أو المتغير B',
      primary: '° ’ ”',
      shiftLabel: 'FACT',
      alphaLabel: 'B',
      variant: 'sci',
    },
    {
      id: 'hyp',
      ariaLabel: 'دوال زائدية hyp أو القيمة المطلقة Abs أو المتغير C',
      primary: 'hyp',
      shiftLabel: 'Abs',
      alphaLabel: 'C',
      variant: 'sci',
    },
    {
      id: 'sin',
      ariaLabel: 'sin جيب الزاوية أو sin⁻¹ أو المتغير D',
      primary: 'sin',
      shiftLabel: 'sin⁻¹',
      alphaLabel: 'D',
      variant: 'sci',
    },
    {
      id: 'cos',
      ariaLabel: 'cos جيب تمام الزاوية أو cos⁻¹ أو المتغير E',
      primary: 'cos',
      shiftLabel: 'cos⁻¹',
      alphaLabel: 'E',
      variant: 'sci',
    },
    {
      id: 'tan',
      ariaLabel: 'tan ظل الزاوية أو tan⁻¹ أو المتغير F',
      primary: 'tan',
      shiftLabel: 'tan⁻¹',
      alphaLabel: 'F',
      variant: 'sci',
    },
  ],
  [
    {
      id: 'rcl',
      ariaLabel: 'RCL استدعاء متغير أو STO تخزين في متغير',
      primary: 'RCL',
      shiftLabel: 'STO',
      variant: 'sci',
    },
    {
      id: 'eng',
      ariaLabel: 'ENG الصيغة الهندسية أو ← أو الوحدة التخيلية i',
      primary: 'ENG',
      shiftLabel: '←',
      cmplxRightLabel: 'i',
      variant: 'sci',
    },
    {
      id: 'open',
      ariaLabel: 'فتح قوس ( أو نسبة مئوية %',
      primary: '(',
      shiftLabel: '%',
      variant: 'sci',
    },
    {
      id: 'close',
      ariaLabel: 'غلق قوس ) أو فاصلة , أو المتغير X',
      primary: ')',
      shiftLabel: ',',
      alphaLabel: 'X',
      variant: 'sci',
    },
    {
      id: 'sd',
      ariaLabel: 'S⇔D تحويل الكسر لعشري أو تحويل عدد كسري أو المتغير Y',
      primary: 'S⇔D',
      shiftLabel: 'a b/c⇔d/c',
      alphaLabel: 'Y',
      variant: 'sci',
    },
    {
      id: 'mplus',
      ariaLabel: 'M+ جمع في الذاكرة أو M− طرح من الذاكرة أو المتغير M',
      primary: 'M+',
      shiftLabel: 'M−',
      alphaLabel: 'M',
      variant: 'sci',
    },
  ],
];

export const LOWER_KEYPAD_ROWS: readonly (readonly KeySpec[])[] = [
  [
    { id: '7', ariaLabel: '7 أو الثوابت العلمية CONST', primary: '7', shiftLabel: 'CONST', variant: 'num' },
    { id: '8', ariaLabel: '8 أو تحويل الوحدات CONV', primary: '8', shiftLabel: 'CONV', variant: 'num' },
    { id: '9', ariaLabel: '9 أو مسح CLR', primary: '9', shiftLabel: 'CLR', variant: 'num' },
    { id: 'del', ariaLabel: 'DEL حذف أو INS إدراج', primary: 'DEL', shiftLabel: 'INS', variant: 'accent' },
    { id: 'ac', ariaLabel: 'AC مسح الكل أو OFF إيقاف', primary: 'AC', shiftLabel: 'OFF', variant: 'accent' },
  ],
  [
    { id: '4', ariaLabel: '4 أو قائمة المصفوفات MATRIX', primary: '4', shiftLabel: 'MATRIX', modeTag: true, variant: 'num' },
    { id: '5', ariaLabel: '5 أو قائمة المتجهات VECTOR', primary: '5', shiftLabel: 'VECTOR', modeTag: true, variant: 'num' },
    { id: '6', ariaLabel: '6 أو قائمة التحقق VERIFY', primary: '6', shiftLabel: 'VERIFY', modeTag: true, variant: 'num' },
    { id: 'multiply', ariaLabel: 'ضرب × أو تباديل nPr أو القاسم المشترك الأكبر GCD', primary: '×', shiftLabel: 'nPr', alphaLabel: 'GCD', variant: 'op' },
    { id: 'divide', ariaLabel: 'قسمة ÷ أو توافيق nCr أو المضاعف المشترك الأصغر LCM', primary: '÷', shiftLabel: 'nCr', alphaLabel: 'LCM', variant: 'op' },
  ],
  [
    { id: '1', ariaLabel: '1 أو قائمة الإحصاء والتوزيعات STAT/DIST', primary: '1', shiftLabel: 'STAT/DIST', modeTag: true, variant: 'num' },
    { id: '2', ariaLabel: '2 أو قائمة الأعداد المركبة CMPLX', primary: '2', shiftLabel: 'CMPLX', modeTag: true, variant: 'num' },
    { id: '3', ariaLabel: '3 أو قائمة الأنظمة العددية BASE', primary: '3', shiftLabel: 'BASE', modeTag: true, variant: 'num' },
    { id: 'add', ariaLabel: 'جمع + أو تحويل قطبي Pol أو الجزء الصحيح Int', primary: '+', shiftLabel: 'Pol', alphaLabel: 'Int', variant: 'op' },
    { id: 'subtract', ariaLabel: 'طرح − أو تحويل كارتيزي Rec أو أكبر عدد صحيح Intg', primary: '−', shiftLabel: 'Rec', alphaLabel: 'Intg', variant: 'op' },
  ],
  [
    { id: '0', ariaLabel: '0 أو تقريب Rnd', primary: '0', shiftLabel: 'Rnd', variant: 'num' },
    { id: 'dot', ariaLabel: 'علامة عشرية · أو رقم عشوائي Ran# أو RanInt', primary: '·', shiftLabel: 'Ran#', alphaLabel: 'RanInt', variant: 'num' },
    { id: 'exp', ariaLabel: '×10^x أس عشرة أو π أو e', primary: '×10ˣ', shiftLabel: 'π', alphaLabel: 'e', variant: 'op' },
    { id: 'ans', ariaLabel: 'Ans آخر إجابة أو DRG▶ أو PreAns', primary: 'Ans', shiftLabel: 'DRG▶', alphaLabel: 'PreAns', variant: 'op' },
    { id: 'equals', ariaLabel: 'يساوي = أو تقريب عشري ≈ أو Re⇔Im', primary: '=', shiftLabel: '≈', cmplxRightLabel: 'Re⇔Im', variant: 'op' },
  ],
];
