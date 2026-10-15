/**
 * `@ck/ui` - the platform design system.
 *
 * Consumed as TypeScript source (no build step) so all four apps share one component
 * implementation and Next.js can tree-shake per route. Apps import tokens via
 * `@ck/ui/tailwind-preset` and `@ck/ui/styles.css`.
 */
export { cn } from './lib/cn';

export { Button, buttonVariants, type ButtonProps } from './components/button';
export { Badge, StatusBadge, humanizeStatus, type BadgeProps } from './components/badge';
export { Card, CardHeader, CardBody, CardFooter, StatCard } from './components/card';
export { Sparkline, BarChart, DonutChart, type ChartPoint } from './components/chart';
export {
  Field,
  Input,
  Textarea,
  fieldControlClasses,
  useFieldWiring,
  type InputProps,
} from './components/field';
export { Select, type SelectOption } from './components/select';
export { Checkbox, Switch, RadioGroup } from './components/toggles';
export { Modal, ConfirmDialog, DialogTrigger, DialogClose } from './components/dialog';
export { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from './components/menu';
export { Tabs, TabList, Tab, TabPanel } from './components/tabs';
export {
  Spinner,
  Skeleton,
  SkeletonText,
  EmptyState,
  ErrorState,
  Alert,
  ProgressBar,
} from './components/feedback';
export { Toaster, toast } from './components/toast';
export {
  TableWrap,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableSkeleton,
  Pagination,
} from './components/table';
export { Avatar, AvatarGroup } from './components/avatar';
export { Tooltip, TooltipProvider } from './components/tooltip';
export { Price, PriceRow, QuantityStepper } from './components/money';
export {
  AppShell,
  TabBar,
  PageHeader,
  Section,
  type NavItem,
  type NavSection,
} from './components/layout';
