export function printDocument(title: string): void {
  const previous = document.title;
  document.title = title;
  window.addEventListener(
    'afterprint',
    () => {
      document.title = previous;
    },
    { once: true }
  );
  window.print();
}