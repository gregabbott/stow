/* By + Copyright 2025 Greg Abbott. V: 2025_0427 */
const el = [...document.querySelectorAll(`[id]:not([id=""])`)]
.reduce((a, e) => (a[e.id.trim()] = e,a), {})//all ELs with IDs
;['g-search','g-notice'].forEach(x=>{
  el[x.replace('g-','')]=document.querySelector('g-notice')
})
let g0 = {}//separated props for grep
function reset_db(){
  g0.db={}//live (parsed) data
  //PROPS
  g0.db.groups={}//+a/b/c
  g0.db.tags={}//@a/b/c
  g0.db.records=new Set()
  g0.record_els=[]
  g0.record_els_matching_search_filter=[]
  g0.menu_items_matching_search=[]
  g0.selected_menu_item=null

  g0.prop_els=new Map()//['+','@'] data in DB records in sidebar
  // selected == any checked dom record rows (ready to act upon)
  g0.selected_records=new Set()// [{data,dom},etc.]
  g0.input_blur_timeout=null//TODO: Improve placeholder solution
  //File access related flags:
  g0.file_is_loaded=false
  g0.has_unsaved_changes=false,
  g0.last_saved_content=''
}
reset_db()
const tag_prefixes = new Set(['+','@'])
const mark_need_to_save=()=>{g0.has_unsaved_changes=true}
//^ on add, edit (done/undone/change data), delete any record
const for_loop=fn=>L=>{for(let i=0;i<L.length;i++)fn(L[i])}
//^loop over non-arrays (e.g. DOM Node lists) without spreading
function new_el(tag,parent){
  let e = document.createElement(tag)
  return parent?parent.appendChild(e):e
}
function on(n,f,l){
  let m = `addEventListener`
  if(l){l[m](n,f);return l}
  return l=>on(n,f,l)
}
function get_date_parts (date=new Date()){
	const p=n=>(date[n]()+(n==='getMonth')+"")
    .padStart(n==='getMilliseconds'?3:2,'0'),
  m = [`FullYear`,`Month`,`Date`,
  `Hours`,`Minutes`,`Seconds`,`Milliseconds`],
  ks = [`Y`,`M`,`d`,`h`,`m`,`s`,`u`],
  o= ks.reduce((a,k,i)=>(a[k]=p('get'+m[i]),a),{})
  o.c=o.Y.substring(0,2)
  o.y=o.Y.substring(2)
  return o
}
function get_stamp(date=new Date()){
  let o = get_date_parts(date)
  const make=x=>x.split('').map(x=>o[x]||x).join('')
  return make(`Y_Md_hm`)
  //basic = make(`Y-M-d`)
  //med = make(`y-M-d.h-m-s`)
}
function reset_app(){
  reset_db()
  load_db_to_frontend()
}
function load_example_db(){
  let demo_date = get_stamp()
  let done_dt = `${demo_date}Z`
  let made_dt = `${demo_date}A`
  let x = `x (A) ${done_dt} ${made_dt} Show an example record @today +app/demo`
  string_db_to_live_db(x)
  load_db_to_frontend()
}
function restore(string_db){
  if(!string_db)return console.log('No data stored to restore')
  string_db_to_live_db(string_db)
  // TODO: store/restore search query
  // el.records_search_query.value=o.query
  load_db_to_frontend()
}
function setup_auto_save(){
  function maybe_store(){
    if(!g0.file_is_loaded||!g0.page_loaded)return
    // page has finished loading and user has opened a file
    // TODO: Store search query
    // el.records_search_query.value.trim(),
    if(g0.has_unsaved_changes) f_action.file_save()
  }
  on("blur",maybe_store,window)
  on("beforeunload",maybe_store,window)
  on('pagehide',maybe_store,window)
  on('visibilitychange',maybe_store,document)//<| Not window
  g0.page_loaded=true
}
function task_line_to_db_object(line) {
  let trimmed = line.trim()+(
    //tool adds space after creation date when making new record
    line.endsWith(' ')?' ':''
  )
  
  let lowTrimmed = trimmed.toLowerCase()// for record search FN
  let done = trimmed.startsWith('x ')
  let parts = lowTrimmed.split(' ')//'+code/js/vanilla'
  let words = lowTrimmed.split(/ |\/|\+|@/)//'code''js''vanilla'
    //^if 'word' comes after [@,+,/] treat as word
      //allows more search matches. E.G. Find:
      //`+work` with only `work`
      //`+work/dev` with only `dev`
      //`@home` with only `home`
  let done_date = ''
  let made = ''
  let offset = 0
  if (done) {
    done_date = parts[1]
    made = parts[2]
    offset = 3
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
    made = parts[0]
    offset = 1
  }
  let rest = parts.slice(offset).join(' ')
  let props = {
    //record might list a prop more than once, only store once
    groups: new Set([]),
    tags: new Set([])
  }
  //collect words in nested properties:+work/dev||@home/kitchen
  rest.split(' ').forEach(word => {
    if(word.length<2)return
    //^ All props have a sign followed by one or more characters
    if(word[0]!=='+'&&word[0]!=='@')return //not a tag
    let kind = {'+':'groups','@':'tags'}[word[0]]
    let tag = word.slice(1).toLowerCase()
    let parts = tag.split('/')
    let acc = ''
    parts.forEach(part => {
      acc = acc ? acc + '/' + part : part
      props[kind].add(acc)
    })
  })
  return {
    raw: trimmed,
    lowTrimmed,
    words,
    done,
    done_date,
    made,
    groups:[...props.groups],
    tags:[...props.tags]
  }
}
function remove_record_data_to_db_collections(record_data){
  let prop_ks=['groups','tags']
  prop_ks.forEach(prop_k=>{
    record_data[prop_k].forEach(prop_v => {
      //eg record_data["groups"]["work"]
      if(/*no prop to remove*/!g0.db[prop_k][prop_v])return
      //decrement count
      g0.db[prop_k][prop_v]=g0.db[prop_k][prop_v]-1
      //if now zero, delete prop
      if(g0.db[prop_k][prop_v]==0){
        delete g0.db[prop_k][prop_v]
        g0.prop_els.delete(prop_v)
      }
    })
  })
}
function add_record_data_to_db_collections(record_data){
  record_data.groups.forEach(p => {
    g0.db.groups[p]=g0.db.groups[p]+1||1
  })
  record_data.tags.forEach(p => {
    g0.db.tags[p]=g0.db.tags[p]+1||1
  })
}
function by_key_sorter(k){
  return (a,b)=>a[k]<b[k]?-1:a[k]>b[k]?1:0
}
function string_db_to_live_db(text) {
  //Parses data in 'text', adds it to any existing DB
  //(Does not replace DB with new DB)
  //Collect list of database records as strings to compare
  let current_lines_in_db = new Set()
  g0.db.records.forEach(record=>{
    current_lines_in_db.add(record.lowTrimmed)
  })
  // if database lacks record found in parsed text, add it
  text
  .trim()
  .split('\n')
  .filter(line => line.trim())
  .reduce((records, line) => {
    if(current_lines_in_db.has(line.toLowerCase().trim())){
      return records
    }
    let record_data = task_line_to_db_object(line)
    records.add(record_data)
    add_record_data_to_db_collections(record_data)
    return records
  }, g0.db.records)
}
function update_sidebars(){
  fill_sidebar_list__groups()
  fill_sidebar_list__tags()
}
function get_first_set_item(set){
  if(!set||set.size===0)return null
  for (const item of set) {
    return item
}
}
function get_only_selected_record_else_false(){
  if(g0.selected_records.size!==1)return false
  return get_first_set_item(g0.selected_records)
}
function start_edit_mode_if_one_record_selected(){
 let record = get_only_selected_record_else_false()
 if(!record) return
  record.dom.row.click()
}
function select_record_or_not_based_on_checked_state(record){
  //user just checked or unchecked a 'select' row checkbox
  if(record.is_selected){
    select_record_if_not_hidden(record)
    record.dom.selector.checked=true
  }
  else{
    deselect_record(record)
  }
}
function strip_date(s,flags='g'){// GA_V2025_0411
  // Remove any substring matching pattern:
  // >7 characters made of digits & -_.:/
  // occurs after string begins or after whitespace
  // followed by whitespace or string end
  let pattern = String.raw
    `(?:^|\s)([\d\-:_\./]{10,}[AZ])(?=\s|$)`
  //^only matches DB dates, ones ending Z(done) or A(made)
  let reg = new RegExp(pattern,flags)
  return s
  .replace(reg,'')
  .replace(/\s{2,}/g, ' ')
  .trim()
}
function strip_first_date(s){return strip_date(s,'')}
function strip_all_dates(s){return strip_date(s,'g')}
function make_record_preview_string(record_data){
  let date_stripped=strip_all_dates(record_data.raw)
  return date_stripped.length===0?'[Record lacks data]':
  date_stripped
}
function record_row_click_fn(e){
  //tbody listener fires when user clicks any item within
  //this FN gets row clicked (which holds a ref to record data)
  //and clicked element within it, which may have unique action
  //e.stopPropagation()//don't cause click event of parent items
  const clicked_row = e.target.closest("tr")
  if(!clicked_row)return
  let record = clicked_row.record //reference attached to it
  let clicked = e.target
  if(clicked==record.dom.selector){
    //^ the checkbox to toggle row/record selection state:
    select_record_or_not_based_on_checked_state(record)
  }
  else{//user clicked any other element
    if(
      //the clicked record is the only selected record
      g0.selected_records.has(record)&&
      g0.selected_records.size===1
    ){
      start_edit_mode(record)
    }
    else{
      deselect_all_records()
      select_record_if_not_hidden(record)
    }
  }
}
on('click',record_row_click_fn,el.records_list)
function make_record_el__does_not_add_to_dom(data){
  let tr = new_el('tr')
      tr.className = 'record'
  let td1 = new_el('td',tr)
  let selector=new_el('input',td1)
      selector.type=`checkbox`
      selector.name='selected_records'
  let td2 = new_el('td',tr)
  let preview = new_el('span',td2)
      preview.textContent = make_record_preview_string(data)
  tr.record = {
    data,
    get is_selected() {
      return selector.checked===true
    },
    dom:{
      row:tr,
      selector,
      preview
    }
  }
  g0.record_els.push(tr)
  return tr.record
}
function sort_records_on_dom__adds_any_not_added(){
  const fragment = document.createDocumentFragment()
  g0.record_els
  .sort((a, b) =>a.record.data.lowTrimmed
    .localeCompare(b.record.data.lowTrimmed)
  )
  .forEach(element => {fragment.appendChild(element)})
  el.records_list.innerHTML = ''
  el.records_list.appendChild(fragment)
}
function load_db_to_frontend() {
  //Reset
  el.records_list.innerHTML = ''
  //Note: db.records is a Set. Spread it to an array to sort
  let sortable = [...g0.db.records]
  sortable
  .sort(by_key_sorter('raw'))
  .forEach(make_record_el__does_not_add_to_dom)
  sort_records_on_dom__adds_any_not_added()
  update_sidebars()
  select_record_below()
  filter_records()
  let n =g0.db.records.size
  update_visible_records_count_frontend()
}
function is_array(l){return Array.isArray(l)}
function supports_disabled(e){
  return ['INPUT','BUTTON','SELECT','TEXTAREA']
  .includes(e.tagName)
}
function disable_one(e){
  if(supports_disabled(e)){e.disabled=true}
  else{e.classList.add('disabled')}
}
function enable_one(e){
  if(supports_disabled(e)){e.disabled=false}
  else{e.classList.remove('disabled')}
}
function disable(e){
  if(is_array(e))e.forEach(disable_one)
  else disable_one(e)
}
function enable(e){
  if(is_array(e))e.forEach(enable_one)
  else enable_one(e)
}
let edit_mode_active=false
function leave_edit_mode() {
  edit_mode_active=false
  el.editor.value = ''
  disable([el.apply_edit,el.editor,el.cancel_edit])
  if(el.editor_po.matches(':popover-open')){
    //ended edit without clicking backdrop, so must:
    el.editor_po.hidePopover()
  }
  if(g0.selected_records.size>0)enable(record_related_buttons)
  enable(el.search)
}
on(
  'toggle',
  ()=>{
  if(
    !el.editor_po.matches(':popover-open')//just closed
    &&edit_mode_active//user clicked backdrop vs button/keypress
  ) leave_edit_mode()
  },
  el.editor_po
)
on(`click`,leave_edit_mode,el.cancel_edit)
function clear_menu_items_searcher(){
  if(el.menu_items_searcher.value.trim().length==0){
    el.menu_items_searcher.blur()
    el.main_menu_po.hidePopover()
  }
  else{
    el.menu_items_searcher.value=''
    el.menu_items_searcher.focus()
    search_menu_items()
  }
}
on(
  `click`,
  clear_menu_items_searcher,
  el.clear_menu_items_searcher
)
on(`input`,search_menu_items,el.menu_items_searcher)
on(`click`,e=>{
  el.main_menu_po.hidePopover()
},el.menu_items)
function show_license_popover(){
  el.po_license.showPopover()
}
on(`click`,show_license_popover,el.show_po_license)
function show_main_menu_popover(){
  el.main_menu_po.showPopover()
  el.menu_items_searcher.focus()
}
on(`click`,show_main_menu_popover,el.show_main_menu_po)
on(`focus`,()=>{
  search_menu_items()
}, el.menu_items_searcher)
let menu_items = [...el.menu_items.getElementsByTagName('div')].map(x=>{
  let o = {
    dom:x,
    dom_text:x.textContent.toLowerCase().trim()
  }
  o.words=o.dom_text.split(/\s+/)
  return o
})
function search_menu_items(){
  let v = el.menu_items_searcher.value.toLowerCase().trim()
  g0.menu_items_matching_search.length=0//reset
  g0.selected_menu_item=null//reset
  function show_menu_item(item){
    g0.menu_items_matching_search.push(item)
    show(item.dom)
  }
  if(v.length==0){
    menu_items.forEach(item=>{
      let is_enabled=!item.dom.classList.contains('disabled')
      if(is_enabled)show_menu_item(item)
      else hide(item.dom)
    })
  }
  else{
    let words_in_query = v.split(/\s+/)
    let one_word=words_in_query.length===1
    menu_items.forEach(item=>{
      let is_enabled=!item.dom.classList.contains('disabled')
      let search_match
      if(one_word){//allow matching mid-word of item text
        search_match=item.dom_text.includes(words_in_query[0])
      }
      else search_match=has_all_query_words(item.words)
      if(is_enabled&&search_match)show_menu_item(item)
      else hide(item.dom)
    })
    function has_all_query_words(item_words){
      return words_in_query.every(query_word=>
      //only match multi-word query words against start of words
        item_words.some(
          item_word=>item_word.startsWith(query_word)
        )
      )
    }
  }
  select_menu_item_below()
}
function select_menu_item(item){
  item.dom.querySelector('input').checked=true
  g0.selected_menu_item=item//let 'Enter' key target item
}
function select_menu_item_below(){
  let list = g0.menu_items_matching_search.length>0
    ?g0.menu_items_matching_search
    :menu_items
  if(list.length===0)return
  let i_of_selected =list.indexOf(g0.selected_menu_item)
  let last_is_selected=list.length-1==i_of_selected
  let i_to_select = last_is_selected?0
    :i_of_selected+1
  if(i_of_selected===i_to_select)return
  select_menu_item(list[i_to_select])
  scroll_into_view_if_needed(g0.selected_menu_item.dom)
}
function select_menu_item_above(){
  let list = g0.menu_items_matching_search.length>0
  ?g0.menu_items_matching_search
  :menu_items
if(list.length===0)return
let i_of_selected =list.indexOf(g0.selected_menu_item)
let first_is_selected=i_of_selected<1//nothing OR first
let i_to_select = first_is_selected?list.length-1:i_of_selected-1
if(i_of_selected===i_to_select)return
select_menu_item(list[i_to_select])
scroll_into_view_if_needed(g0.selected_menu_item.dom)
  scroll_into_view_if_needed(g0.selected_menu_item.dom)
}
on(
  'keydown',
  e => {
    if (e.key === 'Escape'){
      e.preventDefault()
      clear_menu_items_searcher()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if(g0.selected_menu_item){
        e.target.blur()
        e.target.value=''
        g0.selected_menu_item.dom.click()
      }
    }
    if(e.key==='ArrowDown'){
      e.preventDefault()//don't scroll focused element
       select_menu_item_below()
    }
    if(e.key==='ArrowUp'){
      e.preventDefault()//don't scroll focused element
       select_menu_item_above()
    }
  },
  el.menu_items_searcher
)
function start_edit_mode(r) {
  leave_edit_mode()//deactivate any previously active
  edit_mode_active=true
  disable(el.search)
  disable(record_related_buttons)
  el.editor_po.showPopover()
  el.editor.value = r.data.raw
  enable(el.editor)
  el.editor.focus()
  //On start edit mode, store record's initial value,
  //editor listens and enables [apply] button when value changes
  el.editor.initial_value = r.data.raw
  enable(el.cancel_edit)
}
on(
  'keydown',
  e=>{
    if (e.key === 'Escape') {
      e.preventDefault()
      leave_edit_mode()
      //^ TODO: prevent double trigger
    }
    if(e.key ==='Enter'){
      e.preventDefault()
      apply_edits_to_selected_record()
    }
  },
    el.editor
)
on(
  `input`,
  e => {
    let v = el.editor.value
    let is_blank = v.trim().length===0
    let is_unchanged = v === el.editor.initial_value
    let disable = is_blank || is_unchanged
    el.apply_edit.disabled = disable
  },
  el.editor
)
function set_record_value_to(new_str,record){//record={dom,data}
  //keywords: change_record edit_record
  //triggered by:
  //  apply_edits_to_selected_record
  //  mark_record_done
  //  mark_record_undone
  if(!record||!new_str)return
  let data = record.data
  //As current stats (e.g. tag counts) reflect old data value:
  remove_record_data_to_db_collections(data)
  let updated = task_line_to_db_object(new_str)
  add_record_data_to_db_collections(updated)
  Object.assign(data, updated)//Changes properties, not object
  mark_need_to_save()
  record.dom.preview.textContent =
    make_record_preview_string(updated)
  sort_records_on_dom__adds_any_not_added()//to reflect new data
  update_sidebars()//new or changed record properties and counts
  return record
}
function apply_edits_to_selected_record(){
  if(g0.selected_records.size!==1)return
  let record = get_first_set_item(g0.selected_records)
  if(!record)return
  let raw = el.editor.value.trim()
  let is_blank=raw.length==0
  let is_unchanged = raw == record.data.raw
  if (is_blank||is_unchanged) return //continue editing
  set_record_value_to(raw,record)
  filter_records()//update displayed matches
  leave_edit_mode()
  select_record_if_not_hidden(record)//re-highlight in list
}
on(
  'click',
  apply_edits_to_selected_record,
  el.apply_edit
)
function delete_record(record){//{dom,data}
  remove_record_data_to_db_collections(record.data)
  update_sidebars()
  //delete record.data
  g0.db.records.delete(record.data)
  //delete record.domEl from dom and sets
  record.dom.row.remove()
  g0.selected_records.delete(record)
  mark_need_to_save()
  //Empty then re-fill array (Don't replace it)
  g0.record_els.length=0
  for_loop(l=>g0.record_els.push(l))
    (document.getElementsByClassName('record'))
  filter_records()//list has changed & counts may have changed
}
function delete_any_selected_records(){
  g0.selected_records.forEach(delete_record)
  toggle_record_related_buttons_based_on_selection()
}
on(
  `click`,
  () => {
    delete_any_selected_records()
    el.delete_dialog.close()
  },
  el.delete_confirm
)
on(
  'click',()=>{
    el.delete_dialog.close()//only fires when wrapped in FN
  },
  el.delete_cancel
)
function escape_regex_string(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const cut_all_instances_of_substring_from_string=(sub,str)=>{
  let re=new RegExp(
    `(?:^| )(${escape_regex_string(sub)})(?= |$)`,`gi`
  )
  return str.replace(re,' ')
}
const ADD_substring_in_records_search_query=s=>{
  let re=new RegExp(
    `(?:^| )(${escape_regex_string(s)})(?: |$)`,`gi`
  )
  let search_field=el.records_search_query
  if(re.test(search_field.value))return//string already present
  search_field.value += (search_field.value.length>0?' ':'') + s
}
const CUT_substring_in_records_search_query=s=>{
  let field=el.records_search_query
  let before=field.value
  let after=cut_all_instances_of_substring_from_string(s,before)
  if(after===before)return false//no change == not found/removed
  field.value = after
  .replaceAll('  ',' ')
  .trim()
  return true
}
function toggle_string_presence_in_records_search_query(str){
  //remove if present. add if absent (removal success confirms)
  let removed = CUT_substring_in_records_search_query(str)
  if(!removed){ADD_substring_in_records_search_query(str)}
  filter_records()
}
function fill_sidebar_list(prop_counts,list_dom,prefix) {
  list_dom.innerHTML = ''
  function build_tree_of_props(paths) {
    //e.g. IN {"+work":30, "+work/design":20, "+work/admin":10}
    let root = {}
    Object.keys(paths).forEach(path => {
      let parts = path.split('/')
      let node = root
      parts.forEach((part, index) => {
        if (!node[part]) {
          node[part] = { _children: {}, _count: 0 }
        }
        if (index === parts.length - 1) {
          node[part]._count = paths[path]
        }
        node = node[part]._children
      })
    })
    return root
  }
  let counter=0
  let id_prefix = (prefix[0]==='+'?'p':'c')+'$'
  function tick_fn(e){
    toggle_string_presence_in_records_search_query(
      e.currentTarget.prefixed//,li
      //^ element on which the listener was set
      // not any clicked element (within)
    )
  }
  function search_for_group_property_value(e){
    strip_from_search_value_any_groups()
    el.records_search_query.value+=' '+e.currentTarget.prefixed
    el.records_search_query.value=el.records_search_query.value.replace(/\s{2,}/g,' ').trim()
    filter_records()
  }
  on(`click`,e=>{
    //Only allow the details marker "|>"" to toggle fold states
    //(On click any element in summary, don't toggle details)
    if (
      //clicked element inside of a summary
      e.target.closest('summary')&&
      e.target.tagName === 'label'
    ) {
      // Prevent the click from bubbling up to the summary
      e.preventDefault()
      e.stopPropagation()
    }
  },list_dom)
  function create_property_value_el(name, prefixed, count) {
    //examples:
    //prefixed: `+work/writing'
    //name: 'writing' (last part)
    //let holder = new_el('div')
    let label = new_el('label')
    let tick = new_el('input',label)
    let name_el = new_el('span',label)
    name_el.textContent=name
    if(prefix=='+'){
      tick.type=`radio`
      tick.name='rg1'//link radios together
      on('change',search_for_group_property_value,tick)
    }
    else{
      tick.type=`checkbox`
      on('change', tick_fn, tick)
    }
    tick.id=id_prefix+counter++
    tick.prefixed=prefixed//for listener fn to access
    let count_el=new_el('span',label)
    count_el.textContent=count
    //when the searchbar value updates,
    //and has a property substring,
    //tool searches for the related element by name in this Map:
    g0.prop_els.set(prefixed,tick)//(to set its 'active' state)
    return label
  }
  function build_dom_tree(tree, parent_path) {
    let ul = new_el('ul')
    Object.keys(tree).sort().forEach(tag => {
      let data = tree[tag]
      let path = parent_path ? `${parent_path}/${tag}` : tag
      let li = new_el('li',ul)
      let has_children = Object.keys(data._children).length > 0
      let tag_el = create_property_value_el(
        tag,
        `${prefix}${path}`,
        data._count
      )
      if (has_children) {
        let details = new_el('details',li)
            details.open=true
        let summary = new_el('summary',details)
          summary.appendChild(tag_el)
        details.appendChild(build_dom_tree(data._children,path))
      } else {
        li.appendChild(tag_el)
      }
    })
    return ul
  }
  let tree = build_tree_of_props(prop_counts)
  let frag = document.createDocumentFragment()
  frag.appendChild(build_dom_tree(tree, ''))
  list_dom.appendChild(frag)
  return list_dom
}
function fill_sidebar_list__groups() {
  fill_sidebar_list(
    g0.db.groups,
    el.groups_list,
    '+',
  )
}
function fill_sidebar_list__tags() {
  fill_sidebar_list(
    g0.db.tags,
    el.tags_list,
    '@',
  )
}
function clear_records_search_query(){
  let x = el.records_search_query
  if(x.value.length==0){
    x.blur()
  }
  else{
    x.value=''
    x.focus()
  }
  filter_records()
}
on(
  `click`,
  clear_records_search_query,
  el.clear_records_search_query
)
function strip_from_search_value_any_groups(){
  let field = el.records_search_query
  field.value = field
    .value
    .replace(/(^|\s)\+[^\s]+/g, '')//Escape the plus
    .trim()
}
on(
  `click`,
  ()=>{
    strip_from_search_value_any_groups()
    filter_records()
  },
  el.strip_from_search_value_any_groups
)
function strip_from_search_value_any_tags(){
  let field = el.records_search_query
  // PRE: `verb subject @context on friday`
  // POST: `verb subject on friday`
  field.value = field.value
    .replace(/(^|\s)@[^\s]+/g, '')
    .trim()
  filter_records()
}
on(
  'click',
  strip_from_search_value_any_tags,
  el.strip_from_search_value_any_tags
)
on(
  'focus',()=>leave_edit_mode(),el.records_search_query
)
on(
  'input',
  ()=>{
  //when user types in input field to change filter:
  deselect_all_records()
  filter_records()
  select_first_record_shown_in_list()
  //in any other re-filter event,
  //  such as: marked done, undone, changed text
  //  keep initially selected records selected
  //  providing they are still visible
},el.records_search_query)
on(
'click',()=>{
  CUT_substring_in_records_search_query('DONE')
  CUT_substring_in_records_search_query('DO')
  filter_records()
},el.show_state_any)
on('click',()=>{
  //Must first
  CUT_substring_in_records_search_query('DONE')
  ADD_substring_in_records_search_query('DO')
  filter_records()
},el.show_state_todo)
on('click',()=>{
  CUT_substring_in_records_search_query('DO')
  ADD_substring_in_records_search_query('DONE')
  filter_records()
},el.show_state_done)
function hide(l){l.classList.add('hide')}
function show(l){l.classList.remove('hide')}
//==============================================================
// FILE Access 4 read write chromium & IndexedDB remember handle
const idb = (() => {
  const db_name = 'fileHandleDB'
  const store_name = 'handles'
  const key_name = '2025_0417'
  /* EG indexedDB:{
      //DBS
      bookShop:{
        //STORES in DB:
        books:{
          //RECORDS in STORE
          key:'Poirot'
        }
        users:{}
        orders:{}
      }
  }*/
  let db = null
  const o ={}
  o.open_db = () => new Promise((res, rej) => {
    const req = indexedDB.open(db_name, 1)
    req.onupgradeneeded = e => {
      const d = e.target.result
      if (!d.objectStoreNames.contains(store_name))
        d.createObjectStore(store_name, { keyPath: 'id' })
    }
    req.onsuccess = e => {
      db = e.target.result
      res()
    }
    req.onerror = e => rej(e.target.error)
  })
  const tx = (mode, act) => new Promise((res, rej) => {
    const req = act(db.transaction(store_name, mode).objectStore(store_name))
    req.onsuccess = () => res(req.result)
    req.onerror = e => rej(e.target.error)
  })
  o.save_handle=(handle,name)=>
    tx('readwrite',s=>s.put({id:key_name,handle,name}))
  o.load_handle = () =>tx('readonly', s => s.get(key_name))
  o.delete_handle = ()=>tx('readwrite', s => s.delete(key_name))
  return o
})()
const fs = {
  check_permission: async (handle, mode = 'readwrite') => {
    const opts = { mode }
    const p = await handle.queryPermission(opts)
    return p === 'granted' ? true :
      await handle.requestPermission(opts) === 'granted'
  }
}
const set_file_status = msg => el.file_status.textContent = msg
const show_file_dialog = msg => {
  el.file_dialog_message.textContent = msg
  el.file_dialog.showModal()
}
on(
  `click`,
  ()=>{el.file_dialog.close()},
  el.file_dialog_done_button
)
window.addEventListener('beforeunload', e => {
  //Alert to save here
  if (g0.has_unsaved_changes) { e.preventDefault() }
})
const f_action = {}
f_action.update_file_buttons = async () => {
  const r = await idb.load_handle()
  const items = [
    el.file_forget,
    el.file_save,
    el.file_save_as
  ]
  items.forEach(r?enable:disable)
  if (r&&!g0.file_is_loaded){
    //indexedDB has a stored file handle user hasn't opened yet:
    show(el.file_load_stored)//Offer to reopen:
    el.file_load_stored.textContent = `Reopen "${r.name}"`
    disable(el.file_close)
  }
  else{
    hide(el.file_load_stored)
    enable(el.file_close)
  }
}
f_action.load_editor = async (handle, name = null) => {
  //first close any existing file
  await f_action.file_close()
  //if user manually closed, app would have made dummy DB
  reset_app()//clear that
  set_file_status('Reading file...')
  //Read file
  if (!await fs.check_permission(handle, 'read')){
    throw Error('Read permission denied')
  }
  const f = await handle.getFile()
  let is_text = f.type.startsWith('text/')
  if(!is_text){
    return show_file_dialog(`Not text file`)
    //let data = f.arrayBuffer()
  }
  const data = await f.text()//To parse
  restore(data)//data==string_db
  g0.has_unsaved_changes = false
  g0.file_is_loaded=true
  if (name) set_file_status(`Loaded "${name}"`)
  await f_action.update_file_buttons()
}
f_action.save_content = async handle => {
  if (!await fs.check_permission(handle)){
    throw Error('Write permission denied')
  }
  const w = await handle.createWritable()
  let content = live_db_to_string_db()
  await w.write(content)
  await w.close()
  set_file_status('File saved successfully.')
  //after save:
  g0.file_is_loaded=true
  g0.has_unsaved_changes = false
}
f_action.file_save = async () => {
  const r = await idb.load_handle()
  if (!r) return f_action.file_save_as()
  if (!await fs.check_permission(r.handle)){
     set_file_status('Permission denied.')
  }
  await f_action.save_content(r.handle)
  await f_action.update_file_buttons()
}
f_action.file_save_as = async () => {
  const handle = await window.showSaveFilePicker({
    types: [{
      description:'Text',
      accept:{ 'text/plain': ['.txt']}
    }]
  })
  if (!await fs.check_permission(handle)){
    return set_file_status('Permission denied.')
  }
  const file = await handle.getFile()
  await idb.save_handle(handle, file.name)
  await f_action.save_content(handle)
  await f_action.update_file_buttons()
}
f_action.file_select = async () => {
  const [handle] = await window.showOpenFilePicker()
  set_file_status('Saving file handle...')
  //storeHandle & load
  const name = (await handle.getFile()).name
  await idb.save_handle(handle, name)
  await f_action.load_editor(handle, name)
}
f_action.file_load_stored = async () => {
  const r = await idb.load_handle()
    .catch(e=>{
      console.log(e.message)
      console.log(
        'Possibilities:\n'+
        `- Tool hasn't setup the indexedDB (idb) yet\n`+
        `- idb has no file stored to re-open\n`+
        `- tool tried to open file before user page interaction`
      )
    })
  if(!r){
    return
  }
  if (!await fs.check_permission(r.handle, 'read')){
    set_file_status('Permission not granted.')
  }
  //reopen file, using handle to it previous session stored
  await f_action.load_editor(r.handle, r.name)
}
f_action.file_close = async () => {
  if (
    g0.has_unsaved_changes &&
    !confirm('You have unsaved changes. Close anyway?')
  ){return false}
  reset_app()
  set_file_status('File closed. Handle remains.')
  await f_action.update_file_buttons()
  return true
}
f_action.file_forget = async () => {
  if(!f_action.file_close())return//user cancelled close
  //close handled resetting app
  await idb.delete_handle()
  set_file_status('Handle Forgotten.')
  await f_action.update_file_buttons()
}
const initial_indexedDB_and_file_access_api = async () => {
  await idb.open_db()
  await f_action.update_file_buttons()
  const r = await idb.load_handle()
  set_file_status(r ? `Stored file found: "${r.name}"` :
    'No stored file. Open or Save As to begin.')
  const button_action_map = [
     'file_select',
     'file_load_stored',
     'file_close',
     'file_forget',
     'file_save',
     'file_save_as',
  ]//ElNames match ActionNames
  button_action_map.forEach(name => {
    el[name].onclick = f_action[name]
  })
}
//==============================================================
function update_visible_records_count_frontend(){
  let total_count = g0.db.records.size
  let hidden_count =
  el.records_list.querySelectorAll('.record.hide').length
  let visible_count=total_count-hidden_count
  el.visible_records.textContent=
    `${visible_count}/${total_count}`
}
function filter_records() {
  //reset some states
  g0.record_els_matching_search_filter.length=0
  let query = el.records_search_query.value.trim()
  //if clear filter
  if(el.records_search_query.value.trim().length===0){
    el.records_list.querySelectorAll('.record').forEach(show)
    update_visible_records_count_frontend()
    g0.prop_els.forEach(tick=>{tick.checked=false})
    disable(el.clear_records_search_query)
    return
  }
  enable(el.clear_records_search_query)
  let seeking_state_todo = false
  let seeking_state_done = false
  let query_sans_state = query
  //Strip out *keywords*
  .replace(
    /\b(DONE|DO)\b/g,
    (all,t)=>{
      console.log(t)
      if(t==='DONE')seeking_state_done=true
      if(t==='DO')seeking_state_todo=true
      return ''
    }
  )
  .replace(/ {2,}/,' ')
  .toLowerCase()
  .trim()
  //highlight actively queried properties in sidebar
  el.show_state_todo.checked=seeking_state_todo
  el.show_state_done.checked=seeking_state_done
  el.show_state_any.checked=
    !seeking_state_done && !seeking_state_todo
  //e.g. searching +work, highlight in sidebar
  let needs_to_match_words =query_sans_state.length>0
  let words_to_find=[]
  let props_to_find=new Set()//e.g. [+groups,@tags]
  let props_to_find_list = []
  query_sans_state.split(' ').forEach(piece=>{
    if(tag_prefixes.has(piece[0])){
      //store tag +this @that
      props_to_find.add(piece)
      props_to_find_list.push(piece)
    }
    // store word
    else words_to_find.push(piece)
  })
  //update sidebar styling
  g0.prop_els.forEach((tick,tag)=>{
    //note: not triggering onchange, just ticking checkbox
    //(as search value already holds associated string)
    tick.checked=props_to_find.has(tag)
  })
  el.records_list.querySelectorAll('.record')
  .forEach(div => {
    let t = div.record.data//{}
    let meets_any_done_condition=seeking_state_done?t.done:true
    let meets_any_todo_condition=seeking_state_todo?!t.done:true
    let meets_properties_condition = props_to_find_list
    .every(needed=>t.lowTrimmed.includes(needed))
  let has_any_queried_contents = needs_to_match_words?
    (
    words_to_find.length===1
    //if finding one word, allow matching mid-word
    ?t.lowTrimmed.includes(words_to_find[0])
    //if many, each word must match the start of a word in value
    :words_to_find.every(word=>
      t.words.some(
        word_in_value=>word_in_value.startsWith(word)
      )
    )
    )
    :true
    let should_show =
          meets_any_done_condition
        &&meets_any_todo_condition
        &&meets_properties_condition
        &&has_any_queried_contents
    if(should_show){
      g0.record_els_matching_search_filter.push(div)
      show(div)
    }
    else{//non match
      hide(div)
      if(div.record.is_selected){
        deselect_record(div.record)//deselect no longer visible
      }
    }
    })
    update_visible_records_count_frontend()
}

on('click',add_new_record,el.add_new_record)
function scroll_into_view_if_needed(el){
  const elementRect = el.getBoundingClientRect()
  const parent = el.parentNode
  const parentRect = parent.getBoundingClientRect()
  let is = {
    above:elementRect.top < parentRect.top,
    below:elementRect.bottom > parentRect.bottom
  }
  if (is.below) {
    //make element's bottom touch bottom of view area
    parent.scrollTop += (elementRect.bottom - parentRect.bottom)
  }
  else if (is.above) {
    //make element's top touch top of view area
    parent.scrollTop += (elementRect.top - parentRect.top)
  }
}
function up_down_record_row_nav(e){
  let rec = null
  let f = {
    'ArrowDown':select_record_below,
    'ArrowUp':select_record_above
  }[e.key]||false
  if(!f)return
  //as up / down keys scroll any focused scrollable element:
  e.preventDefault()
  rec=f()
  if(rec){ scroll_into_view_if_needed(rec.dom.row) }
}
on(
  'keydown',
  e => {
    //1 select all, 2 clear 3 blur
    if (e.key === 'Escape'){
      e.preventDefault()
      clear_records_search_query()
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
    }
    up_down_record_row_nav(e)
  },
  el.records_search_query
)
let record_related_buttons = [
  el.show_delete_dialog,
  el.mark_done,
  el.mark_undone,
  el.deselect_all,
  el.edit_record,
  el.add_new_record,
  el.clone_record
]
function toggle_record_related_buttons_based_on_selection(){
  //when user selects one or more records, enable these
  record_related_buttons.forEach(
    g0.selected_records.size===0?disable:enable
  )
  enable(el.add_new_record)
  //with exactly 1 record selected, enable these:
  let one_fn =g0.selected_records.size===1?enable:disable
  ;[el.clone_record,el.edit_record].forEach(one_fn)
}
on('click',()=>{
  if(g0.selected_records.size!==1)return
  start_edit_mode(get_first_set_item(g0.selected_records))
},el.edit_record)
function deselect_all_records(){
  leave_edit_mode()
  g0.selected_records.forEach(deselect_record)
  g0.selected_records.clear()
}
on('click',deselect_all_records,el.deselect_all)
function deselect_record(record){
  if(!record)return console.log('pass deselect_record a record')
  record.dom.selector.checked=false
  g0.selected_records.delete(record)
  toggle_record_related_buttons_based_on_selection()
}
function record_is_hidden(record){
  return record.dom.row.classList.contains('hide')
}
function select_record_if_not_hidden(record){
  if(!record){
    console.log('pass select_record_if_not_hidden a record')
    return false
  }
  if(record_is_hidden(record))return false//did not select
  g0.selected_records.add(record)
  record.dom.selector.checked=true
  toggle_record_related_buttons_based_on_selection()
}
function get_first_set_item(set){
  return set.values().next().value
}
function get_el_list_to_search(){
  let a = g0.record_els_matching_search_filter//filter matches
  return a.length>0?a:g0.record_els//full list
}
function select_record_above(){
  let list = get_el_list_to_search()
  if(list.length==0||list.size==0){
    //console.log('select_record_above: No records to select')
    return 
  }
  let row = null
  if(g0.selected_records.size===0){//first
    row=list[list.length-1]
  }
  else{
    let current_record_i=find_first_index(
      list,
      x=>x.record.is_selected
    )
    row=current_record_i-1<0
      ?list[list.length-1]//next
      :list[current_record_i-1]//back to top
    }
    deselect_all_records()
    select_record_if_not_hidden(row.record)
    return row.record
}
function select_first_record_shown_in_list(){
  let list = get_el_list_to_search()
  if(list.length===0)return
  select_record_if_not_hidden(list[0].record)
}
function select_record_below(){
  let list = get_el_list_to_search()
  if(list.length==0||list.size==0){
    // console.log('select_record_below: No records to select')
    return 
  }
  let row=null
  if(g0.selected_records.size===0){//first
    row=list[0]
  }
  else{
    let current_record_el_i= find_last_index(
      list,
      x=>x.record.is_selected
    )
    let is_last=current_record_el_i==list.length-1
    row=is_last
      ?list[0]//back to top
      :list[current_record_el_i+1]//next
  }
  deselect_all_records()
  select_record_if_not_hidden(row.record)
  return row.record
}
function find_first_index(list, condition) {
  for (let i = 0; i < list.length; i++) {
    if (condition(list[i])) return i
  }
  return -1
}
function find_last_index(list, condition) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (condition(list[i])) return i
  }
  return -1
}
function window_key_down(e) {
  if (e.metaKey && e.key === 'p') {//&& e.shiftKey
    // overrides print because nothing to print
    // will also trigger if user has shiftKey down
    e.preventDefault()
    show_main_menu_popover()
    return
  }
  if(e.ctrlKey|| e.shiftKey|| e.metaKey)return
  //console.log(`Key "${e.key}" pressed`)
  if (e.key === 'n') {
    e.preventDefault()
    add_new_record()
  }
  else if (e.key === 'f') {//Search records
    e.preventDefault()
    el.records_search_query.focus()
  }
  else if (e.key === 'x') {//toggle done of selected
    e.preventDefault()
    mark_selected_records_done()
  }
  else if (e.key === 'd' || e.key ==='Backspace') {
    if(g0.selected_records.size>0){
      e.preventDefault()
      el.show_delete_dialog.click()
    }
    else {
      notify('Select a record to delete it')
    }
  }
  else if(e.key ==='Enter'){
    //TODO: don't fire on same keypress of a previous trigger
    start_edit_mode_if_one_record_selected()
  }
  up_down_record_row_nav(e)
}
function enable_window_keydown_listener() {
  clearTimeout(g0.input_blur_timeout)
  g0.input_blur_timeout=setTimeout(
    ()=>{on('keydown', window_key_down,window)},
    200
  )//time for keypress to release
}
function disable_window_keydown_listener() {
  clearTimeout(g0.input_blur_timeout)
  window.removeEventListener('keydown', window_key_down)
}
on(
  'click',
  ()=>{
    el.delete_dialog.showModal()
    el.delete_confirm.focus()
    disable_window_keydown_listener()
  },
  el.show_delete_dialog
)
on(
  'close',
  () => { enable_window_keydown_listener() },
  el.delete_dialog
)
const inputs = document.querySelectorAll('input, textarea')
inputs.forEach(input => {
  on('focus', disable_window_keydown_listener, input)
  on('blur', enable_window_keydown_listener, input)
})
function mark_record_undone(record){
  if(!record)return
  let data=record.data
  if(!data.done)return//already correct
  let done_date_removed =
    strip_first_date(data.raw)
    .replace('x ','')
  set_record_value_to(done_date_removed,record)
}
function mark_record_done(record){
//record=={dom:{row,selected,preview},data:{keys etc}}
if(!record)return
let data=record.data
if(data.done)return//already correct
let done_date_added = `x ${get_stamp()}Z `+data.raw
set_record_value_to(done_date_added,record)//<| returns record
}
function mark_selected_records_done(){
  g0.selected_records.forEach(mark_record_done)
  filter_records()//hide if new value doesn't match any filter
  // select_record_if_not_hidden(record)
}
function mark_selected_records_undone(){
  g0.selected_records.forEach(mark_record_undone)
  filter_records()//hide if new value doesn't match any filter
}
on('click',mark_selected_records_done,el.mark_done)
on('click',mark_selected_records_undone,el.mark_undone)
function set_notice(s){el.notice.textContent=s}
function notify(str){
  set_notice(str)
  setTimeout(()=>{
    set_notice('')
  },2000)
}
on(
  'click',
  ()=>{
    add_new_record({
      record:get_only_selected_record_else_false()
    })
  },
  el.clone_record
)
function get_string_based_on_current_query(){
  //collect any properties (@tags, +groups) current search value
  //auto-add to new record value
  let properties_in_search_value = el.records_search_query
  .value
  .trim()
  .split(' ')
  .filter(w=>tag_prefixes.has(w[0]))
  .join(' ')
  let space_or_not = (properties_in_search_value.length>0?' ':'')
  return get_stamp()+`A`+//suffixing A or Z to clarify made/done
  space_or_not
    +properties_in_search_value
    +' '
}
function add_new_record({record}={}) {
  //As this FN sometimes receives an event object,
  //Wrapping record argument in object, to check for it easily
  let txt = record
  ?record?.data?.raw//record to clone
  :get_string_based_on_current_query()
  //Make record
  let data = task_line_to_db_object(txt)
  g0.db.records.add(data)
  mark_need_to_save()
  let new_record = make_record_el__does_not_add_to_dom(data)
    //^{data:{},dom:{row,preview,etc}}
  //Update frontend
  sort_records_on_dom__adds_any_not_added()
  add_record_data_to_db_collections(data)
  update_sidebars()
  filter_records()//update match counts of current items
  if(!record){//haven't cloned
    if(record_is_hidden(new_record)){
      notify('Clear the active search to see the new record')
    }
    else{
      //if user had other records selected, deselect those
      deselect_all_records()
      select_record_if_not_hidden(new_record)
      //let user add data to new record
      start_edit_mode_if_one_record_selected()
    }
  }
  return new_record
}
function supports_file_access_api() {
  return 'showOpenFilePicker' in window
  && 'showSaveFilePicker' in window
}
function live_db_to_string_db(){
  //can also use order of dom elements
  //to reflect any presented sort order (vs backend order)
  let a = []
  g0.db.records.forEach(data=>a.push(data.raw))
  return a.join('\n')
}
on('load',async()=>{
  if(!supports_file_access_api()){
    show(el.unsupported_browser)
    return
  }
  await initial_indexedDB_and_file_access_api()//once loaded iDB
  await f_action.update_file_buttons()
  //^if indexedDB has stored file, offers to reopen
  /* User must interact with page for browser to allow:
  if(!g0.file_is_loaded){//no file open
    await f_action.file_load_stored()
  }
  */
  if(!g0.file_is_loaded){//still no file
    load_example_db()
  }
  enable_window_keydown_listener()
  setup_auto_save()
},window)