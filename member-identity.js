(() => {
  const username=value=>String(value||'').trim().toLowerCase();
  const valid=value=>/^[a-z][a-z0-9._-]{2,31}$/.test(username(value));
  // Internal identifier only; these addresses never send mail.
  const email=value=>{
    const name=username(value);
    if(name.includes('@'))return name; // Existing company accounts remain usable.
    if(!valid(name))throw Error('ชื่อผู้ใช้ต้องเป็น a-z, 0-9, จุด ขีด หรือขีดล่าง 3–32 ตัว และขึ้นต้นด้วยตัวอักษร');
    return name+'@members.flowbill.invalid';
  };
  window.MemberIdentity={username,valid,email};
})();
