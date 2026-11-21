
/* NovaMart Axios REST client. No Firebase browser SDK.
   Uses Firebase Identity Toolkit REST and Cloud Firestore REST.
   Firestore security rules remain mandatory for every request. */
const API_KEY = "CONFIGURED_AT_RUNTIME";
const novaApi = (() => {
  const getConfig = () => firebaseConfig;
  const base = () => `https://firestore.googleapis.com/v1/projects/${getConfig().projectId}/databases/(default)/documents`;
  const authBase = "https://identitytoolkit.googleapis.com/v1";
  const tokenBase = "https://securetoken.googleapis.com/v1/token";
  const sessionKey = "novamart_rest_auth";
  let session = JSON.parse(localStorage.getItem(sessionKey) || "null");
  let listeners = [];
  let refreshInFlight = null;

  const encode = v => {
    if (v && v.__restTransform) throw new Error("Transform value cannot be encoded as a field");
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "string") return { stringValue: v };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
  };
  const fields = obj => Object.fromEntries(Object.entries(obj).filter(([,v])=>!(v && v.__restTransform)).map(([k,v])=>[k,encode(v)]));
  const decode = v => {
    if (!v || "nullValue" in v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("timestampValue" in v) {
      const date = new Date(v.timestampValue);
      return { seconds: Math.floor(date.getTime()/1000), toDate: () => new Date(date) };
    }
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
    if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
    return null;
  };
  const decodeFields = obj => Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,decode(v)]));
  const docSnap = doc => ({ id: doc.name.split("/").pop(), exists: true, data: () => decodeFields(doc.fields || {}) });
  const emptyDoc = id => ({ id, exists: false, data: () => undefined });
  const snap = docs => ({ docs, size: docs.length, empty: docs.length === 0 });
  const docName = (collection,id) => `${base()}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;

  const saveSession = data => {
    session = data;
    if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
    else localStorage.removeItem(sessionKey);
  };
  const currentUser = () => session ? { uid: session.localId, email: session.email } : null;
  const notify = () => listeners.forEach(fn => fn(currentUser()));

  async function refresh() {
    if (!session?.refreshToken) return null;
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const { data } = await axios.post(`${tokenBase}?key=${getConfig().apiKey}`,
          new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        saveSession({ ...session, idToken: data.id_token, refreshToken: data.refresh_token,
          localId: data.user_id, expiresAt: Date.now()+Number(data.expires_in)*1000 });
        return session.idToken;
      } catch(e) { saveSession(null); notify(); throw e; }
      finally { refreshInFlight = null; }
    })();
    return refreshInFlight;
  }
  async function getToken() {
    if (!session) return null;
    if (Date.now() > session.expiresAt - 60000) await refresh();
    return session?.idToken || null;
  }
  async function firestoreRequest(config) {
    const token = await getToken();
    return axios({ ...config, headers: { ...(config.headers||{}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }
  async function authRequest(endpoint, data) {
    try {
      return (await axios.post(`${authBase}/${endpoint}?key=${getConfig().apiKey}`, data)).data;
    } catch(e) {
      throw new Error(e.response?.data?.error?.message || e.message);
    }
  }
  async function authenticate(endpoint, email, password) {
    const result = await authRequest(endpoint, { email, password, returnSecureToken: true });
    saveSession({ localId: result.localId, email: result.email, idToken: result.idToken,
      refreshToken: result.refreshToken, expiresAt: Date.now()+Number(result.expiresIn)*1000 });
    notify();
    return { user: currentUser() };
  }
  const auth = {
    get currentUser() { return currentUser(); },
    createUserWithEmailAndPassword: (email,password) => authenticate("accounts:signUp",email,password),
    signInWithEmailAndPassword: (email,password) => authenticate("accounts:signInWithPassword",email,password),
    sendPasswordResetEmail: email => authRequest("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email }),
    async signOut() { saveSession(null); notify(); },
    onAuthStateChanged(fn) { listeners.push(fn); queueMicrotask(()=>fn(currentUser())); return () => {listeners=listeners.filter(x=>x!==fn);}; }
  };

  function transforms(obj, name) {
    return Object.entries(obj).filter(([,v])=>v && v.__restTransform).map(([key,v])=>({
      fieldPath: key, ...(v.__restTransform==="serverTimestamp" ? { setToServerValue: "REQUEST_TIME" } :
        { increment: encode(v.amount) })
    }));
  }
  function writeFor(name, data, mode) {
    const update = { name, fields: fields(data) };
    const fieldTransforms = transforms(data,name);
    const write = { update };
    if (mode==="update") {
      const mask = Object.keys(data).filter(k=>!data[k]?.__restTransform);
      if (mask.length) write.updateMask = { fieldPaths: mask };
    }
    if (mode==="create") write.currentDocument = { exists: false };
    if (mode==="update") write.currentDocument = { exists: true };
    if (fieldTransforms.length) write.updateTransforms = fieldTransforms;
    return write;
  }
  async function commit(writes, transaction) {
    return firestoreRequest({ method:"post", url:`${base()}:commit`,
      data:{ writes, ...(transaction ? {transaction} : {}) } });
  }
  async function list(collection) {
    let token, docs=[];
    do {
      const res = await firestoreRequest({ method:"get", url:`${base()}/${encodeURIComponent(collection)}`,
        params:{ pageSize:1000, ...(token?{pageToken:token}:{}) } });
      docs.push(...(res.data.documents||[]).map(docSnap));
      token=res.data.nextPageToken;
    } while(token);
    return snap(docs);
  }
  function filter(field,op,value) {
    const ops={"==":"EQUAL","!=":"NOT_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL",
      "<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL"};
    if (!ops[op]) throw new Error(`Unsupported filter ${op}`);
    return { fieldFilter:{ field:{fieldPath:field}, op:ops[op], value:encode(value) } };
  }
  async function query(collection,filters,order) {
    const q={from:[{collectionId:collection}]};
    if(filters.length===1) q.where=filters[0];
    if(filters.length>1) q.where={compositeFilter:{op:"AND",filters}};
    if(order) q.orderBy=[{field:{fieldPath:order},direction:"ASCENDING"}];
    const res=await firestoreRequest({method:"post",url:`${base()}:runQuery`,data:{structuredQuery:q}});
    return snap((res.data||[]).filter(x=>x.document).map(x=>docSnap(x.document)));
  }
  function collection(name,filters=[],order=null) {
    return {
      where:(field,op,val)=>collection(name,[...filters,filter(field,op,val)],order),
      orderBy:field=>collection(name,filters,field),
      get:()=>filters.length||order?query(name,filters,order):list(name),
      doc(id=crypto.randomUUID().replace(/-/g,"").slice(0,20)) {
        const path=docName(name,id);
        return {
          id, path,
          async get() {
            try {return docSnap((await firestoreRequest({method:"get",url:path})).data);}
            catch(e) {if(e.response?.status===404)return emptyDoc(id);throw e;}
          },
          set:data=>commit([writeFor(path,data,"set")]),
          update:data=>commit([writeFor(path,data,"update")]),
          delete:()=>commit([{delete:path}])
        };
      },
      async add(data) {
        const ref=collection(name).doc();
        await ref.set(data);
        return ref;
      }
    };
  }

  async function runTransaction(callback) {
    const begin=(await firestoreRequest({method:"post",url:`${base()}:beginTransaction`,data:{options:{readWrite:{}}}})).data;
    const txid=begin.transaction;
    let writeStarted=false, writes=[];
    const tx={
      async get(ref) {
        if(writeStarted) throw new Error("All transaction reads must precede writes.");
        const res=await firestoreRequest({method:"post",url:`${base()}:batchGet`,
          data:{documents:[ref.path],transaction:txid}});
        const row=res.data.find(x=>x.found||x.missing);
        return row?.found?docSnap(row.found):emptyDoc(ref.id);
      },
      set(ref,data) {writeStarted=true;writes.push(writeFor(ref.path,data,"set"));},
      update(ref,data) {writeStarted=true;writes.push(writeFor(ref.path,data,"update"));},
      delete(ref) {writeStarted=true;writes.push({delete:ref.path});}
    };
    try {
      const result=await callback(tx);
      await commit(writes,txid);
      return result;
    } catch(e) {
      try {await firestoreRequest({method:"post",url:`${base()}:rollback`,data:{transaction:txid}});}
      catch (_) {}
      throw e;
    }
  }
  const db={collection,runTransaction};
  return { auth,db,getToken };
})();
const auth = firebaseReady ? novaApi.auth : null;
const api = firebaseReady ? novaApi.db : null;
