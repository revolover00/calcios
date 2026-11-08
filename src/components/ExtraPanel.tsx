import React, { useMemo, useState } from 'react';
import { Calculator, Cpu, FlaskConical, Layers, ArrowLeftRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { SCIENTIFIC_CONSTANTS, UNIT_CONVERSIONS } from '../core/constants';
import type { CalculatorAction, CalculatorState } from '../core/calculator';
import { formatDecimal } from '../core/format';
import { VARIABLES, deserialize } from '../core/value';
import { COVERAGE_MATRIX } from '../data/keyLayout';

interface ExtraPanelProps {
  state: CalculatorState;
  dispatch: React.Dispatch<CalculatorAction>;
}

type PanelTab = 'functions' | 'constants' | 'conversions' | 'modes';

const ALL_MODES = [
  { id: 'COMP', code: '1', title: 'COMP', desc: 'حسابات علمية عامة', ready: true },
  { id: 'CMPLX', code: '2', title: 'CMPLX', desc: 'أعداد مركبة', ready: false },
  { id: 'STAT', code: '3', title: 'STAT', desc: 'إحصاء وانحدار', ready: false },
  { id: 'BASE-N', code: '4', title: 'BASE-N', desc: 'أنظمة العد والمنطق 32-bit', ready: true },
  { id: 'EQN', code: '5', title: 'EQN', desc: 'معادلات خطية وتربيعية وتكعيبية', ready: true },
  { id: 'MATRIX', code: '6', title: 'MATRIX', desc: 'مصفوفات حتى 3×3', ready: false },
  { id: 'TABLE', code: '7', title: 'TABLE', desc: 'جدولة الدوال f(X) و g(X)', ready: true },
  { id: 'VECTOR', code: '8', title: 'VECTOR', desc: 'متجهات 2D/3D', ready: false },
  { id: 'INEQ', code: '▼1', title: 'INEQ', desc: 'متباينات الدرجة 2 و 3', ready: false },
  { id: 'VERIF', code: '▼2', title: 'VERIF', desc: 'التحقق من صحة العلاقات', ready: false },
  { id: 'DIST', code: '▼3', title: 'DIST', desc: 'التوزيعات الاحتمالية', ready: false },
] as const;

export function ExtraPanel({ state, dispatch }: ExtraPanelProps): React.ReactElement {
  const [tab, setTab] = useState<PanelTab>('functions');
  const [constQuery, setConstQuery] = useState('');
  const [convQuery, setConvQuery] = useState('');

  const press = (id: string) => dispatch({ type: 'key', id });

  const filteredConstants = useMemo(() => {
    const q = constQuery.trim().toLowerCase();
    if (!q) return SCIENTIFIC_CONSTANTS;
    return SCIENTIFIC_CONSTANTS.filter(
      (c) =>
        c.code.includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.nameAr.includes(q) ||
        c.nameEn.toLowerCase().includes(q),
    );
  }, [constQuery]);

  const filteredConversions = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    if (!q) return UNIT_CONVERSIONS;
    return UNIT_CONVERSIONS.filter(
      (c) =>
        c.code.includes(q) ||
        c.label.toLowerCase().includes(q) ||
        c.categoryAr.includes(q),
    );
  }, [convQuery]);

  return (
    <aside className="extra-panel" dir="rtl" aria-label="لوحة وظائف fx-991ES PLUS C الإضافية">
      <div className="extra-panel-header">
        <div>
          <h2 className="extra-panel-title">ملحق وظائف fx-991ES PLUS C</h2>
          <p className="extra-panel-subtitle">
            الوظائف والثوابت والأوضاع غير المطبوعة على أزرار جسم fx-95ES PLUS
          </p>
        </div>
        <div className="extra-active-badges" dir="ltr">
          <span className="status-pill">{state.mode}</span>
          <span className="status-pill">{state.angle}</span>
          <span className="status-pill">{state.ioMode}IO</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="extra-tabs" role="tablist" aria-label="أقسام الوظائف الإضافية">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'functions'}
          className={tab === 'functions' ? 'extra-tab active' : 'extra-tab'}
          onClick={() => setTab('functions')}
        >
          <Calculator size={15} />
          <span>التفاضل وحل المعادلات</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'constants'}
          className={tab === 'constants' ? 'extra-tab active' : 'extra-tab'}
          onClick={() => setTab('constants')}
        >
          <FlaskConical size={15} />
          <span>الثوابت (40)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'conversions'}
          className={tab === 'conversions' ? 'extra-tab active' : 'extra-tab'}
          onClick={() => setTab('conversions')}
        >
          <ArrowLeftRight size={15} />
          <span>التحويلات (40)</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'modes'}
          className={tab === 'modes' ? 'extra-tab active' : 'extra-tab'}
          onClick={() => setTab('modes')}
        >
          <Layers size={15} />
          <span>الأوضاع والتغطية</span>
        </button>
      </nav>

      {/* Tab 1: Missing 991ES+C Keys, Variables & BASE-N Logic */}
      {tab === 'functions' && (
        <div className="extra-tab-body">
          <section className="extra-card">
            <h3 className="extra-section-heading">أزرار الصف العلوي في fx-991ES PLUS C</h3>
            <div className="extra-key-grid">
              <button type="button" className="extra-fn-btn" onClick={() => press('calc')}>
                <span className="extra-fn-main" dir="ltr">CALC</span>
                <span className="extra-fn-sub">تعويض متغيرات</span>
              </button>
              <button type="button" className="extra-fn-btn extra-fn-gold" onClick={() => press('solve')}>
                <span className="extra-fn-main" dir="ltr">SOLVE</span>
                <span className="extra-fn-sub">حل عددي لـ X</span>
              </button>
              <button type="button" className="extra-fn-btn extra-fn-pink" onClick={() => press('eq-sign')}>
                <span className="extra-fn-main" dir="ltr">= (ALPHA)</span>
                <span className="extra-fn-sub">يساوي داخل معادلة</span>
              </button>
              <button type="button" className="extra-fn-btn" onClick={() => press('integ')}>
                <span className="extra-fn-main" dir="ltr">∫dx</span>
                <span className="extra-fn-sub">تكامل محدد</span>
              </button>
              <button type="button" className="extra-fn-btn extra-fn-gold" onClick={() => press('deriv')}>
                <span className="extra-fn-main" dir="ltr">d/dx</span>
                <span className="extra-fn-sub">مشتقة عند نقطة</span>
              </button>
              <button type="button" className="extra-fn-btn extra-fn-gold" onClick={() => press('sigma')}>
                <span className="extra-fn-main" dir="ltr">∑(</span>
                <span className="extra-fn-sub">مجموع متسلسلة</span>
              </button>
              <button type="button" className="extra-fn-btn extra-fn-pink" onClick={() => press('prod')}>
                <span className="extra-fn-main" dir="ltr">∏(</span>
                <span className="extra-fn-sub">ضرب متسلسلة</span>
              </button>
              <button type="button" className="extra-fn-btn extra-fn-pink" onClick={() => press('colon')}>
                <span className="extra-fn-main" dir="ltr">:</span>
                <span className="extra-fn-sub">تعدد الجمل</span>
              </button>
            </div>
            <p className="extra-hint">
              مثال سريع: اضغط <kbd dir="ltr">ALPHA</kbd> ثم <kbd dir="ltr">)</kbd> لكتابة <code dir="ltr">X</code>، أو اضغط أي متغير من القائمة بالأسفل مباشرةً.
            </p>
          </section>

          {/* BASE-N Logic Bar */}
          <section className="extra-card">
            <div className="extra-card-row">
              <h3 className="extra-section-heading">
                <Cpu size={14} style={{ display: 'inline', marginLeft: 6 }} />
                عمليات BASE-N المنطقية والست عشرية
              </h3>
              {state.mode !== 'BASE-N' && (
                <button
                  type="button"
                  className="mini-action-btn"
                  onClick={() => dispatch({ type: 'select-mode', mode: 'BASE-N' })}
                >
                  تفعيل BASE-N
                </button>
              )}
            </div>
            <div className="extra-logic-grid" dir="ltr">
              <button type="button" className="logic-chip" onClick={() => press('basen-and')}>and</button>
              <button type="button" className="logic-chip" onClick={() => press('basen-or')}>or</button>
              <button type="button" className="logic-chip" onClick={() => press('basen-xor')}>xor</button>
              <button type="button" className="logic-chip" onClick={() => press('basen-xnor')}>xnor</button>
              <button type="button" className="logic-chip" onClick={() => press('basen-not')}>Not(</button>
              <button type="button" className="logic-chip" onClick={() => press('basen-neg')}>Neg(</button>
            </div>
          </section>

          {/* Live Memory & Variable Inspector */}
          <section className="extra-card">
            <h3 className="extra-section-heading">محتوى الذاكرة والمتغيرات (اضغط لإدراج المتغير)</h3>
            <div className="var-inspector-grid" dir="ltr">
              {VARIABLES.map((v) => {
                const val = formatDecimal(deserialize(state.variables[v]), state.numberFormat);
                return (
                  <button
                    key={v}
                    type="button"
                    className="var-chip"
                    onClick={() => dispatch({ type: 'insert-token', token: v })}
                    title={`إدراج المتغير ${v}`}
                  >
                    <span className="var-chip-name">{v}</span>
                    <span className="var-chip-val">{val}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className="var-chip var-chip-ans"
                onClick={() => press('ans')}
                title="إدراج آخر نتيجة Ans"
              >
                <span className="var-chip-name">Ans</span>
                <span className="var-chip-val">{formatDecimal(deserialize(state.ans), state.numberFormat)}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: 40 Scientific Constants */}
      {tab === 'constants' && (
        <div className="extra-tab-body">
          <div className="extra-search-wrap">
            <input
              type="search"
              className="extra-search-input"
              placeholder="ابحث برقم الثابت (01–40) أو الرمز (c0, h, NA, g) أو الاسم..."
              value={constQuery}
              onChange={(e) => setConstQuery(e.target.value)}
            />
          </div>
          <div className="extra-list">
            {filteredConstants.map((c) => (
              <button
                key={c.code}
                type="button"
                className="extra-list-row"
                data-testid={`const-${c.code}`}
                onClick={() => dispatch({ type: 'insert-token', token: c.token })}
              >
                <span className="extra-code" dir="ltr">{c.code}</span>
                <span className="extra-sym" dir="ltr">{c.symbol}</span>
                <span className="extra-desc">
                  <strong>{c.nameAr}</strong>
                  <small dir="ltr">{c.value} {c.unit}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: 40 Unit Conversions */}
      {tab === 'conversions' && (
        <div className="extra-tab-body">
          <div className="extra-search-wrap">
            <input
              type="search"
              className="extra-search-input"
              placeholder="ابحث برقم التحويل (01–40) أو الوحدات (in▶cm, °C▶°F, atm)..."
              value={convQuery}
              onChange={(e) => setConvQuery(e.target.value)}
            />
          </div>
          <div className="extra-list">
            {filteredConversions.map((c) => (
              <button
                key={c.code}
                type="button"
                className="extra-list-row"
                data-testid={`conv-${c.code}`}
                onClick={() => dispatch({ type: 'insert-token', token: c.token, behavior: 'continue' })}
              >
                <span className="extra-code" dir="ltr">{c.code}</span>
                <span className="extra-conv-lbl" dir="ltr">{c.label}</span>
                <span className="extra-desc">
                  <strong>{c.categoryAr}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Modes, History & Honest Coverage */}
      {tab === 'modes' && (
        <div className="extra-tab-body">
          <section className="extra-card">
            <h3 className="extra-section-heading">أوضاع التشغيل في fx-991ES PLUS C</h3>
            <div className="modes-grid">
              {ALL_MODES.map((m) => {
                const isCurrent = state.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`mode-card ${isCurrent ? 'active' : ''} ${!m.ready ? 'pending' : ''}`}
                    onClick={() => dispatch({ type: 'select-mode', mode: m.id })}
                  >
                    <div className="mode-card-top" dir="ltr">
                      <span className="mode-code">{m.code}</span>
                      <span className="mode-title">{m.title}</span>
                    </div>
                    <div className="mode-desc">{m.desc}</div>
                    <span className={m.ready ? 'mode-badge ready' : 'mode-badge wip'}>
                      {m.ready ? 'متاح' : 'قيد التطوير'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {state.history.length > 0 && (
            <section className="extra-card">
              <h3 className="extra-section-heading">سجل العمليات الأخيرة</h3>
              <div className="history-list" dir="ltr">
                {[...state.history].reverse().slice(0, 8).map((item, idx) => (
                  <button
                    key={`${item.expression}-${idx}`}
                    type="button"
                    className="history-row"
                    onClick={() => dispatch({ type: 'insert-token', token: item.expression })}
                  >
                    <span className="history-expr">{item.expression}</span>
                    <span className="history-res">= {formatDecimal(deserialize(item.result), state.numberFormat)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="extra-card">
            <h3 className="extra-section-heading">حالة التطابق والتغطية الهندسية (بشفافية)</h3>
            <div className="coverage-list">
              {COVERAGE_MATRIX.map((row) => (
                <div key={row.feature} className="coverage-item">
                  <div className="coverage-item-head">
                    {row.status === 'verified' && <CheckCircle2 size={15} className="cov-icon verified" />}
                    {row.status === 'numerical' && <AlertCircle size={15} className="cov-icon numerical" />}
                    {row.status === 'in-progress' && <Clock size={15} className="cov-icon wip" />}
                    <strong>{row.feature}</strong>
                  </div>
                  <p>{row.noteAr}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
