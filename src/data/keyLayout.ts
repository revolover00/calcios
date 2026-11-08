export interface KeySpec {
  id: string;
  ariaLabel: string;
  primary: string;
  shiftLabel?: string;
  alphaLabel?: string;
  baseNLabel?: string;
  col?: number;
  variant: 'sci' | 'num' | 'op' | 'accent';
}

export const SCIENTIFIC_ROW_1: readonly KeySpec[] = [
  { id: 'abs', ariaLabel: 'Abs القيمة المطلقة', primary: 'Abs', col: 1, variant: 'sci' },
  { id: 'cube', ariaLabel: 'x³ تكعيب', primary: 'x³', alphaLabel: ':', col: 2, variant: 'sci' },
  { id: 'inverse', ariaLabel: 'x⁻¹ مقلوب أو مضروب', primary: 'x⁻¹', shiftLabel: 'x!', col: 5, variant: 'sci' },
  { id: 'logbase', ariaLabel: 'log_a b لوغاريتم لأساس عام', primary: 'log■□', col: 6, variant: 'sci' },
];

export const SCIENTIFIC_ROWS_2_TO_4: readonly (readonly KeySpec[])[] = [
  [
    { id: 'frac', ariaLabel: 'كسر اعتيادي أو عدد كسري', primary: '■/□', shiftLabel: '■ □/□', variant: 'sci' },
    { id: 'sqrt', ariaLabel: 'جذر تربيعي أو تكعيبي', primary: '√■', shiftLabel: '³√■', variant: 'sci' },
    { id: 'square', ariaLabel: 'x² تربيع', primary: 'x²', baseNLabel: 'DEC', variant: 'sci' },
    { id: 'power', ariaLabel: 'أس عام أو جذر نوني', primary: 'x■', shiftLabel: 'ⁿ√■', baseNLabel: 'HEX', variant: 'sci' },
    { id: 'log', ariaLabel: 'log لوغاريتم عشري', primary: 'log', shiftLabel: '10■', baseNLabel: 'BIN', variant: 'sci' },
    { id: 'ln', ariaLabel: 'ln لوغاريتم طبيعي', primary: 'ln', shiftLabel: 'e■', baseNLabel: 'OCT', variant: 'sci' },
  ],
  [
    { id: 'neg', ariaLabel: 'إشارة سالبة أو المتغير A', primary: '(−)', alphaLabel: 'A', variant: 'sci' },
    { id: 'dms', ariaLabel: 'درجات ودقائق وثواني أو تحليل لعوامل أولية FACT', primary: '° ’ ”', shiftLabel: 'FACT', alphaLabel: 'B', variant: 'sci' },
    { id: 'hyp', ariaLabel: 'دوال زائدية hyp أو المتغير C', primary: 'hyp', alphaLabel: 'C', variant: 'sci' },
    { id: 'sin', ariaLabel: 'sin جيب الزاوية', primary: 'sin', shiftLabel: 'sin⁻¹', alphaLabel: 'D', variant: 'sci' },
    { id: 'cos', ariaLabel: 'cos جيب تمام الزاوية', primary: 'cos', shiftLabel: 'cos⁻¹', alphaLabel: 'E', variant: 'sci' },
    { id: 'tan', ariaLabel: 'tan ظل الزاوية', primary: 'tan', shiftLabel: 'tan⁻¹', alphaLabel: 'F', variant: 'sci' },
  ],
  [
    { id: 'rcl', ariaLabel: 'RCL استدعاء أو STO حفظ في متغير', primary: 'RCL', shiftLabel: 'STO', variant: 'sci' },
    { id: 'eng', ariaLabel: 'ENG الصيغة الهندسية', primary: 'ENG', shiftLabel: '←', variant: 'sci' },
    { id: 'open', ariaLabel: 'فتح قوس أو نسبة مئوية', primary: '(', shiftLabel: '%', variant: 'sci' },
    { id: 'close', ariaLabel: 'غلق قوس أو فاصلة أو المتغير X', primary: ')', shiftLabel: ',', alphaLabel: 'X', variant: 'sci' },
    { id: 'sd', ariaLabel: 'S⇔D تحويل الكسر لعشري', primary: 'S⇔D', shiftLabel: 'a b/c⇔d/c', alphaLabel: 'Y', variant: 'sci' },
    { id: 'mplus', ariaLabel: 'M+ إضافة للذاكرة المستقلة', primary: 'M+', shiftLabel: 'M−', alphaLabel: 'M', variant: 'sci' },
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
    { id: '4', ariaLabel: '4 أو المصفوفات MATRIX', primary: '4', shiftLabel: 'MATRIX', variant: 'num' },
    { id: '5', ariaLabel: '5 أو المتجهات VECTOR', primary: '5', shiftLabel: 'VECTOR', variant: 'num' },
    { id: '6', ariaLabel: '6 أو التحقق VERIFY', primary: '6', shiftLabel: 'VERIFY', variant: 'num' },
    { id: 'multiply', ariaLabel: 'ضرب أو تباديل nPr', primary: '×', shiftLabel: 'nPr', variant: 'op' },
    { id: 'divide', ariaLabel: 'قسمة أو توافيق nCr', primary: '÷', shiftLabel: 'nCr', variant: 'op' },
  ],
  [
    { id: '1', ariaLabel: '1 أو الإحصاء STAT', primary: '1', shiftLabel: '┌STAT┐', variant: 'num' },
    { id: '2', ariaLabel: '2 أو الأعداد المركبة CMPLX', primary: '2', shiftLabel: '┌CMPLX┐', variant: 'num' },
    { id: '3', ariaLabel: '3 أو الأنظمة العددية BASE', primary: '3', shiftLabel: 'BASE', variant: 'num' },
    { id: 'add', ariaLabel: 'جمع أو تحويل قطبي Pol', primary: '+', shiftLabel: 'Pol', variant: 'op' },
    { id: 'subtract', ariaLabel: 'طرح أو تحويل كارتيزي Rec', primary: '−', shiftLabel: 'Rec', variant: 'op' },
  ],
  [
    { id: '0', ariaLabel: '0 أو تقريب Rnd', primary: '0', shiftLabel: 'Rnd', variant: 'num' },
    { id: 'dot', ariaLabel: 'علامة عشرية أو رقم عشوائي', primary: '·', shiftLabel: 'Ran#', alphaLabel: 'RanInt', variant: 'num' },
    { id: 'exp', ariaLabel: '×10^x أس عشرة أو π أو e', primary: '×10ˣ', shiftLabel: 'π', alphaLabel: 'e', variant: 'op' },
    { id: 'ans', ariaLabel: 'Ans آخر إجابة أو DRG▶', primary: 'Ans', shiftLabel: 'DRG▶', variant: 'op' },
    { id: 'equals', ariaLabel: 'يساوي =', primary: '=', variant: 'op' },
  ],
];
