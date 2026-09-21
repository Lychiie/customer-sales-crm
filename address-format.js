// Presentation only: keep source addresses unchanged in every document.
(() => {
  const format = value => {
    const original = String(value ?? '').replace(/\r\n?/g, '\n').trim();
    const singleLine = original.replace(/\s+/g, ' ');
    const district = /อำเภอ|(?:^|\s)เขต|(?:^|\s)อ\./.exec(singleLine);
    if (!district) return original;
    const first = singleLine.slice(0, district.index).trim();
    const second = singleLine.slice(district.index).trim();
    return first ? first + '\n' + second : second;
  };
  window.DocumentAddress = { format };
})();
