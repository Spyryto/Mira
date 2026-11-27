const fail=message=>{throw Error('Data schema: '+message);};
// Portable wire subset: closed, first-order data only. The checker, not this
// generator, specializes and unifies the actual function signature.
export function requirePortable(schema,depth=0){
  if(!schema||depth>30)fail('Type exceeds wire depth');
  switch(schema.kind){
    case 'Number': case 'Text': case 'Boolean': return;
    case 'List': return requirePortable(schema.item,depth+1);
    case 'Record':
      if(schema.tail!==null||!schema.fields.length)fail('Schema requires nonempty closed records');
      for(const field of schema.fields){
        if(/^-?\d+$/.test(field.name))fail('nonportable record key '+field.name);
        requirePortable(field.type,depth+1);
      }
      return;
    default: fail('Schema requires concrete data types, got '+schema.kind);
  }
}
