export interface ScientificConstant {
  code: string;
  token: string;
  symbol: string;
  nameAr: string;
  nameEn: string;
  value: string;
  unit: string;
}

export interface UnitConversion {
  code: string;
  token: string;
  label: string;
  categoryAr: string;
  factor?: string;
  inverse?: boolean;
  kind?: 'f-to-c' | 'c-to-f';
}

/**
 * 40 scientific constants matching the Casio fx-991ES PLUS C reference table (CODATA 2010).
 */
export const SCIENTIFIC_CONSTANTS: readonly ScientificConstant[] = [
  { code: '01', token: 'const01', symbol: 'mp', nameAr: 'كتلة البروتون', nameEn: 'Proton mass', value: '1.672621777e-27', unit: 'kg' },
  { code: '02', token: 'const02', symbol: 'mn', nameAr: 'كتلة النيوترون', nameEn: 'Neutron mass', value: '1.674927351e-27', unit: 'kg' },
  { code: '03', token: 'const03', symbol: 'me', nameAr: 'كتلة الإلكترون', nameEn: 'Electron mass', value: '9.10938291e-31', unit: 'kg' },
  { code: '04', token: 'const04', symbol: 'mμ', nameAr: 'كتلة الميون', nameEn: 'Muon mass', value: '1.883531475e-28', unit: 'kg' },
  { code: '05', token: 'const05', symbol: 'a0', nameAr: 'نصف قطر بور', nameEn: 'Bohr radius', value: '5.2917721092e-11', unit: 'm' },
  { code: '06', token: 'const06', symbol: 'h', nameAr: 'ثابت بلانك', nameEn: 'Planck constant', value: '6.62606957e-34', unit: 'J·s' },
  { code: '07', token: 'const07', symbol: 'μN', nameAr: 'المغناطون النووي', nameEn: 'Nuclear magneton', value: '5.05078353e-27', unit: 'J/T' },
  { code: '08', token: 'const08', symbol: 'μB', nameAr: 'مغناطون بور', nameEn: 'Bohr magneton', value: '9.27400968e-24', unit: 'J/T' },
  { code: '09', token: 'const09', symbol: 'ħ', nameAr: 'ثابت بلانك المختزل', nameEn: 'Planck constant / 2π', value: '1.054571726e-34', unit: 'J·s' },
  { code: '10', token: 'const10', symbol: 'α', nameAr: 'ثابت البنية الدقيقة', nameEn: 'Fine-structure constant', value: '7.2973525698e-3', unit: '' },
  { code: '11', token: 'const11', symbol: 're', nameAr: 'نصف قطر الإلكترون الكلاسيكي', nameEn: 'Classical electron radius', value: '2.8179403267e-15', unit: 'm' },
  { code: '12', token: 'const12', symbol: 'λc', nameAr: 'طول موجة كومبتون', nameEn: 'Compton wavelength', value: '2.4263102389e-12', unit: 'm' },
  { code: '13', token: 'const13', symbol: 'γp', nameAr: 'النسبة الجيرومغناطيسية للبروتون', nameEn: 'Proton gyromagnetic ratio', value: '267522200.5', unit: 's⁻¹·T⁻¹' },
  { code: '14', token: 'const14', symbol: 'λcp', nameAr: 'طول موجة كومبتون للبروتون', nameEn: 'Proton Compton wavelength', value: '1.32140985623e-15', unit: 'm' },
  { code: '15', token: 'const15', symbol: 'λcn', nameAr: 'طول موجة كومبتون للنيوترون', nameEn: 'Neutron Compton wavelength', value: '1.3195909068e-15', unit: 'm' },
  { code: '16', token: 'const16', symbol: 'R∞', nameAr: 'ثابت ريدبرغ', nameEn: 'Rydberg constant', value: '10973731.568539', unit: 'm⁻¹' },
  { code: '17', token: 'const17', symbol: 'u', nameAr: 'ثابت الكتلة الذرية', nameEn: 'Atomic mass constant', value: '1.660538921e-27', unit: 'kg' },
  { code: '18', token: 'const18', symbol: 'μp', nameAr: 'العزم المغناطيسي للبروتون', nameEn: 'Proton magnetic moment', value: '1.410606743e-26', unit: 'J/T' },
  { code: '19', token: 'const19', symbol: 'μe', nameAr: 'العزم المغناطيسي للإلكترون', nameEn: 'Electron magnetic moment', value: '-9.28476430e-24', unit: 'J/T' },
  { code: '20', token: 'const20', symbol: 'μn', nameAr: 'العزم المغناطيسي للنيوترون', nameEn: 'Neutron magnetic moment', value: '-9.6623647e-27', unit: 'J/T' },
  { code: '21', token: 'const21', symbol: 'μμ', nameAr: 'العزم المغناطيسي للميون', nameEn: 'Muon magnetic moment', value: '-4.49044807e-26', unit: 'J/T' },
  { code: '22', token: 'const22', symbol: 'F', nameAr: 'ثابت فاراداي', nameEn: 'Faraday constant', value: '96485.3365', unit: 'C/mol' },
  { code: '23', token: 'const23', symbol: 'e₀', nameAr: 'الشحنة الأولية', nameEn: 'Elementary charge', value: '1.602176565e-19', unit: 'C' },
  { code: '24', token: 'const24', symbol: 'NA', nameAr: 'عدد أفوجادرو', nameEn: 'Avogadro constant', value: '6.02214129e23', unit: 'mol⁻¹' },
  { code: '25', token: 'const25', symbol: 'k', nameAr: 'ثابت بولتزمان', nameEn: 'Boltzmann constant', value: '1.3806488e-23', unit: 'J/K' },
  { code: '26', token: 'const26', symbol: 'Vm', nameAr: 'الحجم المولي للغاز المثالي', nameEn: 'Molar volume of ideal gas', value: '0.022710953', unit: 'm³/mol' },
  { code: '27', token: 'const27', symbol: 'R', nameAr: 'الثابت العام للغازات', nameEn: 'Molar gas constant', value: '8.3144621', unit: 'J/(mol·K)' },
  { code: '28', token: 'const28', symbol: 'c0', nameAr: 'سرعة الضوء في الفراغ', nameEn: 'Speed of light in vacuum', value: '299792458', unit: 'm/s' },
  { code: '29', token: 'const29', symbol: 'C1', nameAr: 'ثابت الإشعاع الأول', nameEn: 'First radiation constant', value: '3.74177153e-16', unit: 'W·m²' },
  { code: '30', token: 'const30', symbol: 'C2', nameAr: 'ثابت الإشعاع الثاني', nameEn: 'Second radiation constant', value: '0.01438777', unit: 'm·K' },
  { code: '31', token: 'const31', symbol: 'σ', nameAr: 'ثابت ستيفان-بولتزمان', nameEn: 'Stefan-Boltzmann constant', value: '5.670373e-8', unit: 'W/(m²·K⁴)' },
  { code: '32', token: 'const32', symbol: 'ε0', nameAr: 'سماحية الفراغ الكهربية', nameEn: 'Electric constant', value: '8.854187817e-12', unit: 'F/m' },
  { code: '33', token: 'const33', symbol: 'μ0', nameAr: 'نفاذية الفراغ المغناطيسية', nameEn: 'Magnetic constant', value: '1.2566370614e-6', unit: 'N/A²' },
  { code: '34', token: 'const34', symbol: 'Φ0', nameAr: 'كمّ الفيض المغناطيسي', nameEn: 'Magnetic flux quantum', value: '2.067833758e-15', unit: 'Wb' },
  { code: '35', token: 'const35', symbol: 'g', nameAr: 'عجلة الجاذبية القياسية', nameEn: 'Standard gravity', value: '9.80665', unit: 'm/s²' },
  { code: '36', token: 'const36', symbol: 'G0', nameAr: 'كمّ المواصلة الكهربية', nameEn: 'Conductance quantum', value: '7.7480917346e-5', unit: 'S' },
  { code: '37', token: 'const37', symbol: 'Z0', nameAr: 'المعاوقة المميزة للفراغ', nameEn: 'Impedance of vacuum', value: '376.730313461', unit: 'Ω' },
  { code: '38', token: 'const38', symbol: 't', nameAr: 'صفر تدريج سلزيوس بالكلفن', nameEn: 'Celsius temperature offset', value: '273.15', unit: 'K' },
  { code: '39', token: 'const39', symbol: 'G', nameAr: 'ثابت الجذب العام لنيوتن', nameEn: 'Gravitational constant', value: '6.67384e-11', unit: 'm³/(kg·s²)' },
  { code: '40', token: 'const40', symbol: 'atm', nameAr: 'الضغط الجوي القياسي', nameEn: 'Standard atmosphere', value: '101325', unit: 'Pa' },
];

export const CONSTANT_BY_TOKEN = new Map(SCIENTIFIC_CONSTANTS.map((c) => [c.token, c]));
export const CONSTANT_BY_CODE = new Map(SCIENTIFIC_CONSTANTS.map((c) => [c.code, c]));

/**
 * 40 metric/imperial unit conversions matching the Casio fx-991ES PLUS C table.
 */
export const UNIT_CONVERSIONS: readonly UnitConversion[] = [
  { code: '01', token: '▸conv01', label: 'in▶cm', categoryAr: 'الطول', factor: '2.54' },
  { code: '02', token: '▸conv02', label: 'cm▶in', categoryAr: 'الطول', factor: '2.54', inverse: true },
  { code: '03', token: '▸conv03', label: 'ft▶m', categoryAr: 'الطول', factor: '0.3048' },
  { code: '04', token: '▸conv04', label: 'm▶ft', categoryAr: 'الطول', factor: '0.3048', inverse: true },
  { code: '05', token: '▸conv05', label: 'yd▶m', categoryAr: 'الطول', factor: '0.9144' },
  { code: '06', token: '▸conv06', label: 'm▶yd', categoryAr: 'الطول', factor: '0.9144', inverse: true },
  { code: '07', token: '▸conv07', label: 'mile▶km', categoryAr: 'الطول', factor: '1.609344' },
  { code: '08', token: '▸conv08', label: 'km▶mile', categoryAr: 'الطول', factor: '1.609344', inverse: true },
  { code: '09', token: '▸conv09', label: 'n mile▶m', categoryAr: 'الطول', factor: '1852' },
  { code: '10', token: '▸conv10', label: 'm▶n mile', categoryAr: 'الطول', factor: '1852', inverse: true },
  { code: '11', token: '▸conv11', label: 'pc▶km', categoryAr: 'الطول الفلكي', factor: '3.08567758e13' },
  { code: '12', token: '▸conv12', label: 'km▶pc', categoryAr: 'الطول الفلكي', factor: '3.08567758e13', inverse: true },
  { code: '13', token: '▸conv13', label: 'ly▶km', categoryAr: 'الطول الفلكي', factor: '9.4607304725808e12' },
  { code: '14', token: '▸conv14', label: 'km▶ly', categoryAr: 'الطول الفلكي', factor: '9.4607304725808e12', inverse: true },
  { code: '15', token: '▸conv15', label: 'acre▶m²', categoryAr: 'المساحة', factor: '4046.8564224' },
  { code: '16', token: '▸conv16', label: 'm²▶acre', categoryAr: 'المساحة', factor: '4046.8564224', inverse: true },
  { code: '17', token: '▸conv17', label: 'gal(US)▶L', categoryAr: 'الحجم', factor: '3.785411784' },
  { code: '18', token: '▸conv18', label: 'L▶gal(US)', categoryAr: 'الحجم', factor: '3.785411784', inverse: true },
  { code: '19', token: '▸conv19', label: 'gal(UK)▶L', categoryAr: 'الحجم', factor: '4.54609' },
  { code: '20', token: '▸conv20', label: 'L▶gal(UK)', categoryAr: 'الحجم', factor: '4.54609', inverse: true },
  { code: '21', token: '▸conv21', label: 'oz▶g', categoryAr: 'الكتلة', factor: '28.349523125' },
  { code: '22', token: '▸conv22', label: 'g▶oz', categoryAr: 'الكتلة', factor: '28.349523125', inverse: true },
  { code: '23', token: '▸conv23', label: 'lb▶kg', categoryAr: 'الكتلة', factor: '0.45359237' },
  { code: '24', token: '▸conv24', label: 'kg▶lb', categoryAr: 'الكتلة', factor: '0.45359237', inverse: true },
  { code: '25', token: '▸conv25', label: 'km/h▶m/s', categoryAr: 'السرعة', factor: '3.6', inverse: true },
  { code: '26', token: '▸conv26', label: 'm/s▶km/h', categoryAr: 'السرعة', factor: '3.6' },
  { code: '27', token: '▸conv27', label: 'atm▶Pa', categoryAr: 'الضغط', factor: '101325' },
  { code: '28', token: '▸conv28', label: 'Pa▶atm', categoryAr: 'الضغط', factor: '101325', inverse: true },
  { code: '29', token: '▸conv29', label: 'mmHg▶Pa', categoryAr: 'الضغط', factor: '133.322387415' },
  { code: '30', token: '▸conv30', label: 'Pa▶mmHg', categoryAr: 'الضغط', factor: '133.322387415', inverse: true },
  { code: '31', token: '▸conv31', label: 'kgf/cm²▶Pa', categoryAr: 'الضغط', factor: '98066.5' },
  { code: '32', token: '▸conv32', label: 'Pa▶kgf/cm²', categoryAr: 'الضغط', factor: '98066.5', inverse: true },
  { code: '33', token: '▸conv33', label: 'lbf/in²▶kPa', categoryAr: 'الضغط', factor: '6.894757293168' },
  { code: '34', token: '▸conv34', label: 'kPa▶lbf/in²', categoryAr: 'الضغط', factor: '6.894757293168', inverse: true },
  { code: '35', token: '▸conv35', label: 'hp▶kW', categoryAr: 'القدرة', factor: '0.745699871582' },
  { code: '36', token: '▸conv36', label: 'kW▶hp', categoryAr: 'القدرة', factor: '0.745699871582', inverse: true },
  { code: '37', token: '▸conv37', label: '°F▶°C', categoryAr: 'الحرارة', kind: 'f-to-c' },
  { code: '38', token: '▸conv38', label: '°C▶°F', categoryAr: 'الحرارة', kind: 'c-to-f' },
  { code: '39', token: '▸conv39', label: 'J▶cal', categoryAr: 'الطاقة', factor: '4.1858', inverse: true },
  { code: '40', token: '▸conv40', label: 'cal▶J', categoryAr: 'الطاقة', factor: '4.1858' },
];

export const CONVERSION_BY_TOKEN = new Map(UNIT_CONVERSIONS.map((c) => [c.token, c]));
export const CONVERSION_BY_CODE = new Map(UNIT_CONVERSIONS.map((c) => [c.code, c]));
