"use client";

import { Fragment, useEffect } from "react";
import { HOME_SECTIONS } from "@/components/home";
import { Loading } from "@/components/loading";
import { useShop } from "@/components/shop-provider";

export default function HomePage() {
  const { data, loaded } = useShop();
  // arriving at /#story etc. from another page: scroll once the sections exist
  useEffect(() => {
    if (!loaded || !window.location.hash || /access_token/.test(window.location.hash)) return;
    const el = document.getElementById(window.location.hash.slice(1));
    setTimeout(() => el?.scrollIntoView({ behavior: "smooth" }), 300);
  }, [loaded]);
  if (!loaded) return <Loading />;
  const order: { id: string; visible: boolean }[] = data.settings.home_sections || Object.keys(HOME_SECTIONS).map((id) => ({ id, visible: true }));
  return <>{order.filter((s) => s.visible && HOME_SECTIONS[s.id]).map((s) => <Fragment key={s.id}>{HOME_SECTIONS[s.id]()}</Fragment>)}</>;
}
