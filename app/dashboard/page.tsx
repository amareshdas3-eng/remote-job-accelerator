import Dashboard from '../../components/Dashboard';import {supabaseServer} from '../../lib/supabase';import {redirect} from 'next/navigation';
export default async function Page(){const s=await supabaseServer();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');return <Dashboard email={user.email||''}/>}
