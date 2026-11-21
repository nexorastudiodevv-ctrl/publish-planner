export function Offline() {
  return (
    <main className="screen-center" lang="ar" dir="rtl">
      <section className="panel" style={{ maxWidth: 460, textAlign: 'center' }}>
        <h1>أنت غير متصل</h1>
        <p>لا يوجد اتصال بالإنترنت حاليًا. انتظر عودة الشبكة ثم حدّث الصفحة.</p>
        <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
          إعادة المحاولة
        </button>
      </section>
    </main>
  );
}
