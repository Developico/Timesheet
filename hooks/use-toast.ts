"use client";
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 4000;

type ToasterToast = ToastProps & { id: string; title?: React.ReactNode; description?: React.ReactNode; action?: ToastActionElement };
const actionTypes = { ADD_TOAST: "ADD_TOAST", UPDATE_TOAST: "UPDATE_TOAST", DISMISS_TOAST: "DISMISS_TOAST", REMOVE_TOAST: "REMOVE_TOAST" } as const;
let count = 0; const genId = () => (++count).toString();
type Action =
  | { type: typeof actionTypes.ADD_TOAST; toast: ToasterToast }
  | { type: typeof actionTypes.UPDATE_TOAST; toast: Partial<ToasterToast> }
  | { type: typeof actionTypes.DISMISS_TOAST; toastId?: string }
  | { type: typeof actionTypes.REMOVE_TOAST; toastId?: string };

interface State { toasts: ToasterToast[] }
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const addToRemoveQueue = (id: string) => { if(toastTimeouts.has(id)) return; const t=setTimeout(()=>{ toastTimeouts.delete(id); dispatch({type:actionTypes.REMOVE_TOAST, toastId:id}); }, TOAST_REMOVE_DELAY); toastTimeouts.set(id,t); };

export const reducer = (state: State, action: Action): State => {
  switch(action.type){
    case actionTypes.ADD_TOAST:
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0,TOAST_LIMIT) };
    case actionTypes.UPDATE_TOAST:
      return { ...state, toasts: state.toasts.map(t=> t.id===action.toast.id? {...t,...action.toast}: t) };
    case actionTypes.DISMISS_TOAST:
      return { ...state, toasts: state.toasts.map(t=> (action.toastId===undefined || t.id===action.toastId)? {...t, open:false }: t) };
    case actionTypes.REMOVE_TOAST:
      return { ...state, toasts: action.toastId? state.toasts.filter(t=>t.id!==action.toastId): [] };
    default: return state;
  }
};
const listeners: Array<(s:State)=>void> = []; let memoryState: State = { toasts: [] };
function dispatch(action: Action){ memoryState = reducer(memoryState, action); listeners.forEach(l=>l(memoryState)); if(action.type===actionTypes.DISMISS_TOAST){ const id=action.toastId; if(id) addToRemoveQueue(id); else memoryState.toasts.forEach(t=>addToRemoveQueue(t.id)); } }

export function toast(props: Omit<ToasterToast,'id'>){ const id = genId(); dispatch({ type: actionTypes.ADD_TOAST, toast: { ...props, id, open:true, onOpenChange:(o)=>{ if(!o) dispatch({type:actionTypes.DISMISS_TOAST, toastId:id}); } } }); return { id, dismiss: ()=> dispatch({type:actionTypes.DISMISS_TOAST, toastId:id})}; }

export function useToast(){ const [state,setState]=React.useState<State>(memoryState); React.useEffect(()=>{ listeners.push(setState); return ()=>{ const i=listeners.indexOf(setState); if(i>-1) listeners.splice(i,1); }; },[]); return { ...state, toast, dismiss:(id?:string)=> dispatch({type:actionTypes.DISMISS_TOAST, toastId:id}) }; }
