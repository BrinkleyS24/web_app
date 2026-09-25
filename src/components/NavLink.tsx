import { NavLink as RouterNavLink, type NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type NavLinkCompatProps = Omit<NavLinkProps, "className"> & {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
};

// A react-router NavLink that takes plain class strings for its active / pending states. It was
// untyped, so every call site was a type error; typing it lets the sidebars check cleanly.
const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
